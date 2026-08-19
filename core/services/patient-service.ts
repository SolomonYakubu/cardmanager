/**
 * Patient service.
 *
 * Patient registration is a use case in its own right: it assigns the record id
 * and creation timestamp (from the injected ports, never inline) and validates
 * the operator-supplied fields before handing a well-formed Patient to the
 * repository, which enforces hospital_no uniqueness.
 */

import type { Patient } from '../domain/models'
import type { PatientRepository } from '../ports/repositories'
import type { Clock, IdGenerator } from '../ports/system'
import { HospitalNo, PatientId } from '../domain/ids'
import { DomainError } from '../domain/errors'

export interface RegisterPatientInput {
  readonly hospitalNo: string
  readonly name: string
  /** ISO-8601 date (YYYY-MM-DD). */
  readonly dateOfBirth: string
  /** Reference used to build the EMR deep link. */
  readonly emrReference: string
  readonly walletNo?: string
}

export class PatientService {
  readonly #repo: PatientRepository
  readonly #clock: Clock
  readonly #ids: IdGenerator

  constructor(repo: PatientRepository, clock: Clock, ids: IdGenerator) {
    this.#repo = repo
    this.#clock = clock
    this.#ids = ids
  }

  async register(input: RegisterPatientInput): Promise<Patient> {
    const name = input.name?.trim()
    if (!name) throw new DomainError('VALIDATION_ERROR', 'patient name is required')
    const emrReference = input.emrReference?.trim()
    if (!emrReference) throw new DomainError('VALIDATION_ERROR', 'EMR reference is required')

    const patient: Patient = {
      id: PatientId(this.#ids.newId()),
      hospitalNo: HospitalNo(input.hospitalNo), // validates non-empty + brands
      name,
      dateOfBirth: input.dateOfBirth,
      emrReference,
      walletNo: input.walletNo,
      createdAt: this.#clock.nowIso(),
    }
    return this.#repo.create(patient)
  }

  list(): Promise<Patient[]> {
    return this.#repo.list()
  }

  get(id: string): Promise<Patient | null> {
    return this.#repo.findById(PatientId(id))
  }
}
