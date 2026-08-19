/**
 * Test data builders — valid Patient/Card records with per-field overrides.
 * Shared by repository and service tests so no test hand-rolls a record.
 *
 * Overrides accept plain strings for ergonomics; the builder brands them.
 */

import { CardId, CardRecordId, HospitalNo, NfcUid, OriginalityCode, PatientId } from '../domain/ids'
import type { Card, Patient } from '../domain/models'
import type { CardStatus } from '../domain/card-status'

export interface PatientOverrides {
  id?: string
  hospitalNo?: string
  name?: string
  dateOfBirth?: string
  emrReference?: string
  createdAt?: string
}

export function makePatient(over: PatientOverrides = {}): Patient {
  return {
    id: PatientId(over.id ?? 'patient-1'),
    hospitalNo: HospitalNo(over.hospitalNo ?? 'H-0001'),
    name: over.name ?? 'Jane Doe',
    dateOfBirth: over.dateOfBirth ?? '1990-05-01',
    emrReference: over.emrReference ?? 'EMR-1',
    createdAt: over.createdAt ?? '2025-01-01T00:00:00.000Z',
  }
}

export interface CardOverrides {
  id?: string
  cardId?: string
  patientId?: string
  hospitalNo?: string
  nfcUid?: string | null
  originalityCode?: string
  status?: CardStatus
  issuedAt?: string | null
  issuedByOperatorId?: string | null
  expiresAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export function makeCard(over: CardOverrides = {}): Card {
  return {
    id: CardRecordId(over.id ?? 'cardrec-1'),
    cardId: CardId(over.cardId ?? 'card-1'),
    patientId: PatientId(over.patientId ?? 'patient-1'),
    hospitalNo: HospitalNo(over.hospitalNo ?? 'H-0001'),
    nfcUid: over.nfcUid == null ? null : NfcUid(over.nfcUid),
    originalityCode: OriginalityCode(over.originalityCode ?? 'oc-1'),
    status: over.status ?? 'RESERVED',
    issuedAt: over.issuedAt ?? null,
    issuedByOperatorId: over.issuedByOperatorId ?? null,
    expiresAt: over.expiresAt ?? null,
    createdAt: over.createdAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: over.updatedAt ?? '2025-01-01T00:00:00.000Z',
  }
}
