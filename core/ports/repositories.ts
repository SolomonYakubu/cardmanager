/**
 * Repository ports (spec §6, §12).
 *
 * All methods are async so the single-station MVP (in-memory / local SQLite)
 * and a future shared backend (spec §12) are interchangeable without touching a
 * single service signature. Services depend only on these interfaces.
 */

import type { Card, Patient } from '../domain/models'
import type { CardEvent } from '../domain/events'
import type { CardId, CardRecordId, HospitalNo, PatientId } from '../domain/ids'

export interface PatientRepository {
  create(patient: Patient): Promise<Patient>
  findById(id: PatientId): Promise<Patient | null>
  findByHospitalNo(hospitalNo: HospitalNo): Promise<Patient | null>
  list(): Promise<Patient[]>
}

export interface CardRepository {
  create(card: Card): Promise<Card>
  /** Persist the full record (used after every state transition). */
  save(card: Card): Promise<Card>
  findById(id: CardRecordId): Promise<Card | null>
  findByCardId(cardId: CardId): Promise<Card | null>
  /** The single ACTIVE card for a patient, if any (spec §8 lookup). */
  findActiveByHospitalNo(hospitalNo: HospitalNo): Promise<Card | null>
  listByPatient(patientId: PatientId): Promise<Card[]>
  listAll(): Promise<Card[]>
}

export interface CardEventRepository {
  /** Append-only: events are never updated or deleted (spec §6). */
  append(event: CardEvent): Promise<CardEvent>
  listByCard(cardRecordId: CardRecordId): Promise<CardEvent[]>
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export interface DesignRepository {
  create(design: import('../domain/models').Design): Promise<import('../domain/models').Design>
  findById(id: string): Promise<import('../domain/models').Design | null>
  list(): Promise<import('../domain/models').Design[]>
  delete(id: string): Promise<void>
  setDefault(id: string): Promise<void>
  getDefault(): Promise<import('../domain/models').Design | null>
}
