import { describe, it, expect, beforeEach } from 'vitest'
import { PatientService } from './patient-service'
import { InMemoryPatientRepository } from '../adapters/memory/patient-repository'
import { FixedClock, SequentialIdGenerator } from '../testing/test-doubles'
import { DomainError } from '../domain/errors'

function setup() {
  const repo = new InMemoryPatientRepository()
  const service = new PatientService(repo, new FixedClock(), new SequentialIdGenerator('patient'))
  return { repo, service }
}

const VALID = {
  hospitalNo: 'H-100',
  name: 'Jane Doe',
  dateOfBirth: '1990-05-01',
  emrReference: 'EMR-42',
}

describe('PatientService.register', () => {
  let service: PatientService
  beforeEach(() => {
    service = setup().service
  })

  it('assigns an id + createdAt and persists the patient', async () => {
    const patient = await service.register(VALID)
    expect(patient.id).toBeTruthy()
    expect(patient.createdAt).toBe('2025-01-01T00:00:00.000Z')
    expect(patient.hospitalNo).toBe('H-100')
    expect(await service.get(patient.id)).toEqual(patient)
  })

  it('trims and rejects a blank name', async () => {
    await expect(service.register({ ...VALID, name: '   ' })).rejects.toBeInstanceOf(DomainError)
  })

  it('rejects a blank EMR reference', async () => {
    await expect(service.register({ ...VALID, emrReference: '' })).rejects.toBeInstanceOf(DomainError)
  })

  it('rejects a duplicate hospital_no (repository invariant)', async () => {
    await service.register(VALID)
    await expect(service.register({ ...VALID, name: 'Someone Else' })).rejects.toBeInstanceOf(
      DomainError,
    )
  })

  it('lists registered patients', async () => {
    await service.register(VALID)
    await service.register({ ...VALID, hospitalNo: 'H-101', name: 'John Roe' })
    expect((await service.list()).map((p) => p.name).sort()).toEqual(['Jane Doe', 'John Roe'])
  })
})
