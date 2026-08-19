import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPatientRepository } from './patient-repository'
import { InMemoryCardRepository } from './card-repository'
import { InMemoryCardEventRepository } from './card-event-repository'
import { makeCard, makePatient } from '../../testing/builders'
import { CardId, CardRecordId, HospitalNo, PatientId } from '../../domain/ids'
import { DomainError } from '../../domain/errors'
import type { CardEvent } from '../../domain/events'

describe('InMemoryPatientRepository', () => {
  let repo: InMemoryPatientRepository
  beforeEach(() => {
    repo = new InMemoryPatientRepository()
  })

  it('creates and finds by id and hospital_no', async () => {
    const patient = makePatient({ id: 'p1', hospitalNo: 'H-1' })
    await repo.create(patient)
    expect(await repo.findById(PatientId('p1'))).toEqual(patient)
    expect(await repo.findByHospitalNo(HospitalNo('H-1'))).toEqual(patient)
    expect(await repo.findById(PatientId('missing'))).toBeNull()
  })

  it('rejects duplicate id and duplicate hospital_no', async () => {
    await repo.create(makePatient({ id: 'p1', hospitalNo: 'H-1' }))
    await expect(repo.create(makePatient({ id: 'p1', hospitalNo: 'H-2' }))).rejects.toThrow(DomainError)
    await expect(repo.create(makePatient({ id: 'p2', hospitalNo: 'H-1' }))).rejects.toThrow(DomainError)
  })
})

describe('InMemoryCardRepository', () => {
  let repo: InMemoryCardRepository
  beforeEach(() => {
    repo = new InMemoryCardRepository()
  })

  it('persists status updates via save', async () => {
    await repo.create(makeCard({ id: 'c1', status: 'RESERVED' }))
    await repo.save(makeCard({ id: 'c1', status: 'NFC_ENCODED' }))
    expect((await repo.findById(CardRecordId('c1')))?.status).toBe('NFC_ENCODED')
  })

  it('finds by card_id', async () => {
    await repo.create(makeCard({ id: 'c1', cardId: 'card-xyz' }))
    expect((await repo.findByCardId(CardId('card-xyz')))?.id).toBe('c1')
    expect(await repo.findByCardId(CardId('nope'))).toBeNull()
  })

  it('findActiveByHospitalNo returns only the ACTIVE card', async () => {
    await repo.create(makeCard({ id: 'old', cardId: 'card-old', hospitalNo: 'H-9', status: 'VOID' }))
    await repo.create(makeCard({ id: 'new', cardId: 'card-new', hospitalNo: 'H-9', status: 'ACTIVE' }))
    const active = await repo.findActiveByHospitalNo(HospitalNo('H-9'))
    expect(active?.id).toBe('new')
  })

  it('lists cards by patient', async () => {
    await repo.create(makeCard({ id: 'c1', cardId: 'card-1', patientId: 'p1' }))
    await repo.create(makeCard({ id: 'c2', cardId: 'card-2', patientId: 'p1' }))
    await repo.create(makeCard({ id: 'c3', cardId: 'card-3', patientId: 'p2' }))
    expect((await repo.listByPatient(PatientId('p1'))).map((c) => c.id).sort()).toEqual(['c1', 'c2'])
  })
})

describe('InMemoryCardEventRepository', () => {
  const evt = (o: {
    id?: string
    cardRecordId?: string
    type?: CardEvent['type']
    at?: string
  }): CardEvent => ({
    id: o.id ?? 'e1',
    cardRecordId: CardRecordId(o.cardRecordId ?? 'c1'),
    type: o.type ?? 'CARD_RESERVED',
    at: o.at ?? '2025-01-01T00:00:00.000Z',
  })

  it('appends and lists events per card, isolating other cards', async () => {
    const repo = new InMemoryCardEventRepository()
    await repo.append(evt({ id: 'e1', cardRecordId: 'c1', type: 'CARD_RESERVED' }))
    await repo.append(evt({ id: 'e2', cardRecordId: 'c1', type: 'NFC_ENCODED' }))
    await repo.append(evt({ id: 'e3', cardRecordId: 'c2', type: 'CARD_RESERVED' }))

    const c1 = await repo.listByCard(CardRecordId('c1'))
    expect(c1.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect((await repo.listAll()).length).toBe(3)
  })
})
