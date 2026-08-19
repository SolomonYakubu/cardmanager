import type { Patient } from '../../domain/models'
import type { HospitalNo, PatientId } from '../../domain/ids'
import type { PatientRepository } from '../../ports/repositories'
import type { SQLiteDatabase } from './database'

export class SqlitePatientRepository implements PatientRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async create(patient: Patient): Promise<Patient> {
    const stmt = this.db.db.prepare(`
      INSERT INTO patients (id, hospitalNo, name, dateOfBirth, emrReference, walletNo, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      patient.id,
      patient.hospitalNo,
      patient.name,
      patient.dateOfBirth,
      patient.emrReference,
      patient.walletNo ?? null,
      patient.createdAt
    )
    return patient
  }

  async findById(id: PatientId): Promise<Patient | null> {
    const stmt = this.db.db.prepare('SELECT * FROM patients WHERE id = ?')
    const row = stmt.get(id) as Patient | undefined
    return row ?? null
  }

  async findByHospitalNo(hospitalNo: HospitalNo): Promise<Patient | null> {
    const stmt = this.db.db.prepare('SELECT * FROM patients WHERE hospitalNo = ?')
    const row = stmt.get(hospitalNo) as Patient | undefined
    return row ?? null
  }

  async list(): Promise<Patient[]> {
    const stmt = this.db.db.prepare('SELECT * FROM patients ORDER BY createdAt DESC')
    return stmt.all() as Patient[]
  }
}
