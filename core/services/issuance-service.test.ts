import { describe, it, expect } from 'vitest'
import { IssuanceService } from './issuance-service'
import { AuditLog } from './audit-log'
import { InMemoryPatientRepository } from '../adapters/memory/patient-repository'
import { InMemoryCardRepository } from '../adapters/memory/card-repository'
import { InMemoryCardEventRepository } from '../adapters/memory/card-event-repository'
import { FakeNfcAdapter } from '../adapters/fake/fake-nfc-adapter'
import { FakePrinterAdapter } from '../adapters/fake/fake-printer-adapter'
import { FakeBarcodeScanner } from '../adapters/fake/fake-barcode-scanner'
import { HmacOriginalitySigner } from '../crypto/originality'
import { FixedClock, SequentialIdGenerator } from '../testing/test-doubles'
import { makePatient } from '../testing/builders'
import { CardId, CardRecordId, NfcUid } from '../domain/ids'
import type { Card } from '../domain/models'

const CHIP = NfcUid('04:AA:BB:CC')
const KEY = 'test-originality-key-at-least-32-bytes-long'

/** Wire the service against in-memory + fake adapters. */
function setup() {
  const clock = new FixedClock()
  const ids = new SequentialIdGenerator()
  const patients = new InMemoryPatientRepository()
  const cards = new InMemoryCardRepository()
  const events = new InMemoryCardEventRepository()
  const audit = new AuditLog(events, clock, ids)
  const nfc = new FakeNfcAdapter({ presentUid: CHIP })
  const printer = new FakePrinterAdapter()
  const barcode = new FakeBarcodeScanner()
  const originality = new HmacOriginalitySigner(KEY)
  const service = new IssuanceService({
    cards,
    patients,
    audit,
    nfc,
    printer,
    barcode,
    originality,
    clock,
    ids,
  })
  return { clock, ids, patients, cards, events, audit, nfc, printer, barcode, originality, service }
}

type Harness = ReturnType<typeof setup>

/** setup + a registered patient + a reserved card ready to issue. */
async function arrange(): Promise<Harness & { card: Card }> {
  const h = setup()
  await h.patients.create(
    makePatient({ id: 'p1', hospitalNo: 'H-1', name: 'Jane Doe', emrReference: 'EMR-42' }),
  )
  const card = await h.service.reserve({ patientId: 'p1', operatorId: 'op-1', stationId: 'st-1' })
  return { ...h, card }
}

const trailOf = async (h: Harness, card: Card) =>
  (await h.audit.history(card.id)).map((e) => e.type)

describe('IssuanceService.reserve', () => {
  it('mints a RESERVED card with a card_id + originality_code and logs it', async () => {
    const h = await arrange()
    expect(h.card.status).toBe('RESERVED')
    expect(h.card.cardId).toBeTruthy()
    // originality_code is the HMAC over this card's card_id.
    expect(h.card.originalityCode).toBe(h.originality.sign(h.card.cardId))
    expect(await trailOf(h, h.card)).toEqual(['CARD_RESERVED'])
  })

  it('refuses to reserve for an unknown patient', async () => {
    const h = setup()
    await expect(h.service.reserve({ patientId: 'ghost' })).rejects.toMatchObject({
      code: 'PATIENT_NOT_FOUND',
    })
  })
})

describe('IssuanceService.issue — happy path', () => {
  it('drives a card through every step to ACTIVE', async () => {
    const h = await arrange()
    h.barcode.setNext(h.card.originalityCode) // the printed barcode scans back genuine

    const result = await h.service.issue(h.card.id, { operatorId: 'op-1', stationId: 'st-1' })

    expect(result.ok).toBe(true)
    expect(result.card.status).toBe('ACTIVE')
    expect(result.card.nfcUid).toBe(CHIP) // chip UID bound at encode
    expect(result.card.issuedAt).not.toBeNull()
    expect(result.card.issuedByOperatorId).toBe('op-1')

    expect(await trailOf(h, h.card)).toEqual([
      'CARD_RESERVED',
      'NFC_ENCODED',
      'NFC_VERIFIED',
      'CARD_PRINTED',
      'PRINT_VERIFIED',
      'CARD_ACTIVATED',
    ])
  })

  it('sends exactly one print job carrying the right artwork', async () => {
    const h = await arrange()
    h.barcode.setNext(h.card.originalityCode)
    await h.service.issue(h.card.id)

    expect(h.printer.jobs).toHaveLength(1)
    const { artwork } = h.printer.jobs[0]
    expect(artwork.patientName).toBe('Jane Doe')
    expect(artwork.hospitalNo).toBe('H-1')
    expect(artwork.barcodeValue).toBe(h.card.originalityCode)
    expect(artwork.emrLink).toContain('EMR-42')
  })

  it('issueForPatient reserves and issues in a single call', async () => {
    const h = setup()
    await h.patients.create(makePatient({ id: 'p1', hospitalNo: 'H-1' }))
    // The first minted card_id is deterministic under SequentialIdGenerator.
    h.barcode.setNext(h.originality.sign(CardId('card-1')))

    const result = await h.service.issueForPatient({ patientId: 'p1', operatorId: 'op-1' })
    expect(result.ok).toBe(true)
    expect(result.card.status).toBe('ACTIVE')
  })
})

describe('IssuanceService.issue — failure states (spec §10)', () => {
  it('stops at NFC_ENCODING_FAILED on a chip write error, without printing', async () => {
    const h = await arrange()
    h.nfc.failWrite = true

    const result = await h.service.issue(h.card.id)

    expect(result.ok).toBe(false)
    expect(result.failedAt).toBe('NFC_ENCODING_FAILED')
    expect(h.printer.jobs).toHaveLength(0) // never reached the printer
    expect(await trailOf(h, h.card)).toEqual(['CARD_RESERVED', 'NFC_ENCODING_FAILED'])
  })

  it('catches a corrupt chip write at read-back verification', async () => {
    const h = await arrange()
    h.nfc.corruptWrite = true // write "succeeds" but stores wrong data

    const result = await h.service.issue(h.card.id)

    expect(result.failedAt).toBe('NFC_ENCODING_FAILED')
    // Reached NFC_ENCODED, then read-back caught the mismatch.
    expect(await trailOf(h, h.card)).toEqual([
      'CARD_RESERVED',
      'NFC_ENCODED',
      'NFC_ENCODING_FAILED',
    ])
  })

  it('stops at PRINT_FAILED on a printer error', async () => {
    const h = await arrange()
    h.printer.failPrint = true

    const result = await h.service.issue(h.card.id)

    expect(result.failedAt).toBe('PRINT_FAILED')
    expect(await trailOf(h, h.card)).toEqual([
      'CARD_RESERVED',
      'NFC_ENCODED',
      'NFC_VERIFIED',
      'PRINT_FAILED',
    ])
  })

  it('rejects a card whose printed barcode fails the originality check', async () => {
    const h = await arrange()
    h.barcode.setNext('forged-or-smudged-code') // will not recompute to the genuine code

    const result = await h.service.issue(h.card.id)

    expect(result.failedAt).toBe('PRINT_FAILED')
    // An explicit ORIGINALITY_REJECTED event is logged before the failure state.
    expect(await trailOf(h, h.card)).toEqual([
      'CARD_RESERVED',
      'NFC_ENCODED',
      'NFC_VERIFIED',
      'CARD_PRINTED',
      'ORIGINALITY_REJECTED',
      'PRINT_FAILED',
    ])
  })
})

describe('IssuanceService.issue — retry & resume', () => {
  it('retries NFC encoding from the failure state', async () => {
    const h = await arrange()
    h.nfc.failWrite = true
    await h.service.issue(h.card.id) // → NFC_ENCODING_FAILED

    h.nfc.failWrite = false
    h.barcode.setNext(h.card.originalityCode)
    const result = await h.service.issue(h.card.id) // resume

    expect(result.ok).toBe(true)
    expect(result.card.status).toBe('ACTIVE')
  })

  it('retries printing from PRINT_FAILED and completes', async () => {
    const h = await arrange()
    h.printer.failPrint = true
    await h.service.issue(h.card.id) // → PRINT_FAILED (NFC already done)

    h.printer.failPrint = false
    h.barcode.setNext(h.card.originalityCode)
    const result = await h.service.issue(h.card.id)

    expect(result.ok).toBe(true)
    expect(h.printer.jobs).toHaveLength(1) // only the successful print was captured
    expect(await trailOf(h, h.card)).toEqual([
      'CARD_RESERVED',
      'NFC_ENCODED',
      'NFC_VERIFIED',
      'PRINT_FAILED',
      'CARD_PRINTED',
      'PRINT_VERIFIED',
      'CARD_ACTIVATED',
    ])
  })

  it('resumes from a mid-flow status without repeating completed steps', async () => {
    const h = await arrange()
    // Simulate a crash that left the card verified-on-NFC but not yet printed.
    const midCard: Card = { ...h.card, status: 'NFC_VERIFIED', nfcUid: CHIP }
    await h.cards.save(midCard)

    // If encoding were re-run it would throw — proving the NFC steps are skipped.
    h.nfc.failWrite = true
    h.barcode.setNext(h.card.originalityCode)

    const result = await h.service.issue(h.card.id)

    expect(result.ok).toBe(true)
    expect(result.card.status).toBe('ACTIVE')
    expect(h.printer.jobs).toHaveLength(1)
  })

  it('is idempotent once the card is ACTIVE', async () => {
    const h = await arrange()
    h.barcode.setNext(h.card.originalityCode)
    await h.service.issue(h.card.id)
    const eventCount = (await h.audit.history(h.card.id)).length

    const again = await h.service.issue(h.card.id)

    expect(again.ok).toBe(true)
    expect(again.card.status).toBe('ACTIVE')
    // No further transitions, so no further events.
    expect((await h.audit.history(h.card.id)).length).toBe(eventCount)
  })

  it('reports CARD_NOT_FOUND for an unknown card record', async () => {
    const h = setup()
    await expect(h.service.issue(CardRecordId('missing'))).rejects.toMatchObject({
      code: 'CARD_NOT_FOUND',
    })
  })
})
