import type { PatientRepository } from '../../ports/repositories'
import type { Patient } from '../../domain/models'
import type { HospitalNo, PatientId } from '../../domain/ids'
import { DomainError } from '../../domain/errors'

/** In-memory PatientRepository for the single-station MVP and for tests. */
export class InMemoryPatientRepository implements PatientRepository {
  readonly #byId = new Map<string, Patient>()

  async create(patient: Patient): Promise<Patient> {
    if (this.#byId.has(patient.id)) {
      throw new DomainError('VALIDATION_ERROR', `patient ${patient.id} already exists`)
    }
    if (await this.findByHospitalNo(patient.hospitalNo)) {
      throw new DomainError('VALIDATION_ERROR', `hospital_no ${patient.hospitalNo} already in use`)
    }
    this.#byId.set(patient.id, patient)
    return patient
  }

  async findById(id: PatientId): Promise<Patient | null> {
    return this.#byId.get(id) ?? null
  }

  async findByHospitalNo(hospitalNo: HospitalNo): Promise<Patient | null> {
    for (const patient of this.#byId.values()) {
      if (patient.hospitalNo === hospitalNo) return patient
    }
    return null
  }

  async list(): Promise<Patient[]> {
    return [...this.#byId.values()]
  }
}
