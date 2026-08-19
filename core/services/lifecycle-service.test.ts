import { describe, it, expect } from 'vitest'
import { CardLifecycleService } from './lifecycle-service'
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
import { makePatient, makeCard } from '../testing/builders'
import { NfcUid } from '../domain/ids'
import { InvalidStatusTransitionError } from '../domain/errors'
import type { CardStatus } from '../domain/card-status'
import type { Card } from '../domain/models'

const CHIP = NfcUid('04:AA:BB:CC')
const KEY = 'test-originality-key-at-least-32-bytes-long'

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
  const issuance = new IssuanceService({
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
  const service = new CardLifecycleService({ cards, audit, clock, issuance })
  return { clock, ids, patients, cards, events, audit, nfc, printer, barcode, originality, issuance, service }
}

type Harness = ReturnType<typeof setup>

/** Register a patient and a card in the given status (default ACTIVE). */
async function seedCard(h: Harness, status: CardStatus = 'ACTIVE'): Promise<Card> {
  await h.patients.create(makePatient({ id: 'p1', hospitalNo: 'H-1' }))
  const card = makeCard({
    id: 'rec-1',
    cardId: 'card-old', // distinct from ids.newCardId() so a reissue can't collide
    patientId: 'p1',
    hospitalNo: 'H-1',
    status,
  })
  await h.cards.create(card)
  return card
}

const typesOf = async (h: Harness, id: Card['id']) =>
  (await h.audit.history(id)).map((e) => e.type)

describe('CardLifecycleService.reportLost', () => {
  it('moves an ACTIVE card to LOST and logs it', async () => {
    const h = setup()
    const card = await seedCard(h, 'ACTIVE')
    const lost = await h.service.reportLost(card.id, { operatorId: 'op-1' })

    expect(lost.status).toBe('LOST')
    expect(await typesOf(h, card.id)).toEqual(['CARD_REPORTED_LOST'])
  })

  it('refuses to report a not-yet-issued card as lost', async () => {
    const h = setup()
    const card = await seedCard(h, 'RESERVED')
    await expect(h.service.reportLost(card.id)).rejects.toBeInstanceOf(InvalidStatusTransitionError)
  })
})

describe('CardLifecycleService.void / expire', () => {
  it('voids an ACTIVE card, then refuses to void it again (terminal)', async () => {
    const h = setup()
    const card = await seedCard(h, 'ACTIVE')
    const voided = await h.service.void(card.id, {}, 'issued in error')

    expect(voided.status).toBe('VOID')
    await expect(h.service.void(card.id)).rejects.toBeInstanceOf(InvalidStatusTransitionError)
  })

  it('expires an ACTIVE card', async () => {
    const h = setup()
    const card = await seedCard(h, 'ACTIVE')
    const expired = await h.service.expire(card.id)

    expect(expired.status).toBe('EXPIRED')
    expect(await typesOf(h, card.id)).toEqual(['CARD_EXPIRED'])
  })
})

describe('CardLifecycleService.reissue', () => {
  it('replaces a lost card with a fresh RESERVED card for the same patient', async () => {
    const h = setup()
    const card = await seedCard(h, 'LOST')

    const { replaced, replacement } = await h.service.reissue(card.id, { operatorId: 'op-1' })

    expect(replaced.status).toBe('REPLACED')
    expect(replacement.status).toBe('RESERVED')
    expect(replacement.patientId).toBe(card.patientId)
    expect(replacement.hospitalNo).toBe(card.hospitalNo)
    expect(replacement.cardId).not.toBe(card.cardId) // card_id changes on reissue

    // The old card records the supersession; the new card records its reservation.
    expect(await typesOf(h, replaced.id)).toEqual(['CARD_REPLACED'])
    expect(await typesOf(h, replacement.id)).toEqual(['CARD_RESERVED'])
  })

  it('fails fast without minting a replacement when the card cannot be replaced', async () => {
    const h = setup()
    const card = await seedCard(h, 'RESERVED') // RESERVED cannot go to REPLACED
    const before = (await h.cards.listByPatient(card.patientId)).length

    await expect(h.service.reissue(card.id)).rejects.toBeInstanceOf(InvalidStatusTransitionError)
    expect((await h.cards.listByPatient(card.patientId)).length).toBe(before) // nothing created
  })
})

describe('full card lifecycle (issue → lost → reissue → issue)', () => {
  it('issues a card, loses it, reissues, and issues the replacement to ACTIVE', async () => {
    const h = setup()
    await h.patients.create(makePatient({ id: 'p1', hospitalNo: 'H-1' }))

    // Issue the first card.
    const first = await h.issuance.reserve({ patientId: 'p1', operatorId: 'op-1' })
    h.barcode.setNext(first.originalityCode)
    const issued = await h.issuance.issue(first.id, { operatorId: 'op-1' })
    expect(issued.card.status).toBe('ACTIVE')

    // It's lost, then reissued.
    await h.service.reportLost(first.id, { operatorId: 'op-1' })
    const { replaced, replacement } = await h.service.reissue(first.id, { operatorId: 'op-1' })
    expect(replaced.status).toBe('REPLACED')

    // Issue the replacement all the way to ACTIVE.
    h.nfc.present(CHIP) // a fresh blank chip at the station
    h.barcode.setNext(replacement.originalityCode)
    const reissued = await h.issuance.issue(replacement.id, { operatorId: 'op-1' })
    expect(reissued.card.status).toBe('ACTIVE')
    expect(reissued.card.cardId).not.toBe(first.cardId)

    // Only the replacement is the ACTIVE card for this patient now.
    const active = await h.cards.findActiveByHospitalNo(first.hospitalNo)
    expect(active?.id).toBe(replacement.id)
  })
})
