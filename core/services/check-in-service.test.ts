import { describe, it, expect } from 'vitest'
import { CheckInService } from './check-in-service'
import { AuditLog } from './audit-log'
import { InMemoryPatientRepository } from '../adapters/memory/patient-repository'
import { InMemoryCardRepository } from '../adapters/memory/card-repository'
import { InMemoryCardEventRepository } from '../adapters/memory/card-event-repository'
import { FakeNfcAdapter } from '../adapters/fake/fake-nfc-adapter'
import { FakeBarcodeScanner } from '../adapters/fake/fake-barcode-scanner'
import { HmacOriginalitySigner } from '../crypto/originality'
import { FixedClock, SequentialIdGenerator } from '../testing/test-doubles'
import { makePatient, makeCard } from '../testing/builders'
import { CardId, HospitalNo, NfcUid } from '../domain/ids'
import type { CardStatus } from '../domain/card-status'
import type { Card } from '../domain/models'

const CHIP_UID = '04:AA:BB'
const KEY = 'test-originality-key-at-least-32-bytes-long'

function setup() {
  const clock = new FixedClock()
  const ids = new SequentialIdGenerator()
  const patients = new InMemoryPatientRepository()
  const cards = new InMemoryCardRepository()
  const events = new InMemoryCardEventRepository()
  const audit = new AuditLog(events, clock, ids)
  const nfc = new FakeNfcAdapter({ presentUid: NfcUid(CHIP_UID) })
  const barcode = new FakeBarcodeScanner()
  const originality = new HmacOriginalitySigner(KEY)
  const service = new CheckInService({ cards, patients, audit, nfc, barcode, originality })
  return { clock, ids, patients, cards, events, audit, nfc, barcode, originality, service }
}

type Harness = ReturnType<typeof setup>

/** Register a patient and a card with a correctly-signed originality code. */
async function seedCard(
  h: Harness,
  opts: { status?: CardStatus; cardId?: string; hospitalNo?: string } = {},
): Promise<Card> {
  const hospitalNo = opts.hospitalNo ?? 'H-1'
  const patient = makePatient({ id: 'p1', hospitalNo, name: 'Jane Doe', emrReference: 'EMR-7' })
  await h.patients.create(patient)
  const cardId = CardId(opts.cardId ?? 'card-1')
  const card = makeCard({
    id: 'rec-1',
    cardId,
    patientId: 'p1',
    hospitalNo,
    nfcUid: CHIP_UID,
    originalityCode: h.originality.sign(cardId),
    status: opts.status ?? 'ACTIVE',
  })
  await h.cards.create(card)
  return card
}

/** Simulate presenting `card` at the check-in station (chip + barcode). */
async function present(h: Harness, card: Card): Promise<void> {
  await h.nfc.write({ cardId: card.cardId, hospitalNo: card.hospitalNo })
  h.barcode.setNext(card.originalityCode)
}

const typesOf = async (h: Harness, card: Card) =>
  (await h.audit.history(card.id)).map((e) => e.type)

describe('CheckInService.checkIn — success', () => {
  it('checks in an ACTIVE card and returns the patient + EMR link', async () => {
    const h = setup()
    const card = await seedCard(h)
    await present(h, card)

    const result = await h.service.checkIn({ operatorId: 'op-1', stationId: 'desk-1' })

    expect(result.ok).toBe(true)
    expect(result.card?.id).toBe(card.id)
    expect(result.patient?.name).toBe('Jane Doe')
    expect(result.emrLink).toContain('EMR-7')
    // Genuineness confirmed, then check-in recorded.
    expect(await typesOf(h, card)).toEqual(['ORIGINALITY_VERIFIED', 'CARD_CHECKED_IN'])
  })

  it('can skip the originality scan when asked', async () => {
    const h = setup()
    const card = await seedCard(h)
    await h.nfc.write({ cardId: card.cardId, hospitalNo: card.hospitalNo })
    // Note: no barcode queued — it must not be scanned.

    const result = await h.service.checkIn({ verifyOriginality: false })

    expect(result.ok).toBe(true)
    expect(await typesOf(h, card)).toEqual(['CARD_CHECKED_IN'])
  })
})

describe('CheckInService.checkIn — rejections (spec §8)', () => {
  it('rejects when no card matches the chip', async () => {
    const h = setup()
    // A chip that identifies a card not on file.
    await h.nfc.write({ cardId: CardId('ghost'), hospitalNo: HospitalNo('H-1') })

    const result = await h.service.checkIn()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ACTIVE_CARD_NOT_FOUND')
  })

  it('rejects when the chip hospital_no does not match the record', async () => {
    const h = setup()
    const card = await seedCard(h, { hospitalNo: 'H-1' })
    // Same card_id, but the chip carries a different hospital_no.
    await h.nfc.write({ cardId: card.cardId, hospitalNo: HospitalNo('H-999') })
    h.barcode.setNext(card.originalityCode)

    const result = await h.service.checkIn()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('HOSPITAL_NO_MISMATCH')
  })

  it('rejects a non-ACTIVE (e.g. LOST) card even if the barcode still computes', async () => {
    // This is the duplication backstop from spec §1/§8.
    const h = setup()
    const card = await seedCard(h, { status: 'LOST' })
    await present(h, card) // barcode is genuine, but the card is LOST

    const result = await h.service.checkIn()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ACTIVE_CARD_NOT_FOUND')
    expect(result.detail).toContain('LOST')
  })

  it('rejects a forged/mismatched barcode and logs ORIGINALITY_REJECTED', async () => {
    const h = setup()
    const card = await seedCard(h)
    await h.nfc.write({ cardId: card.cardId, hospitalNo: card.hospitalNo })
    h.barcode.setNext('photocopied-or-forged') // will not recompute

    const result = await h.service.checkIn()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('ORIGINALITY_REJECTED')
    expect(await typesOf(h, card)).toEqual(['ORIGINALITY_REJECTED'])
  })

  it('returns a HARDWARE_ERROR result rather than throwing on a bad read', async () => {
    const h = setup()
    await seedCard(h)
    // Chip UID is present, but nothing was written → read() reports a blank chip.

    const result = await h.service.checkIn()

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('HARDWARE_ERROR')
  })
})
