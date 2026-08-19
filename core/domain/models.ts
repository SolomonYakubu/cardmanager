/**
 * Core records (spec §6).
 *
 * Note `Card.hospitalNo` is intentionally denormalized from the patient: the
 * check-in flow (spec §8) cross-checks the hospital_no read off the NFC chip
 * against the card record, so the card carries its own copy.
 */

import type {
  CardId,
  CardRecordId,
  HospitalNo,
  NfcUid,
  OriginalityCode,
  PatientId,
} from './ids'
import type { CardStatus } from './card-status'

export interface Patient {
  readonly id: PatientId
  /** Patient-facing hospital number, fixed for life, unique. */
  readonly hospitalNo: HospitalNo
  readonly name: string
  /** ISO-8601 date (YYYY-MM-DD). */
  readonly dateOfBirth: string
  /** Reference used to build the EMR deep link in the QR channel. */
  readonly emrReference: string
  readonly walletNo?: string
  readonly createdAt: string
}

export interface Card {
  readonly id: CardRecordId
  /** Identifier for THIS physical card instance; changes on every reissue. */
  readonly cardId: CardId
  readonly patientId: PatientId
  readonly hospitalNo: HospitalNo
  /** NFC chip UID, bound at issuance once a blank chip is detected. */
  readonly nfcUid: NfcUid | null
  /** HMAC over card_id; lives on the barcode only. */
  readonly originalityCode: OriginalityCode
  readonly status: CardStatus
  readonly issuedAt: string | null
  readonly issuedByOperatorId: string | null
  readonly expiresAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type Role = 'OPERATOR' | 'ADMINISTRATOR' | 'AUDITOR'

export interface Design {
  readonly id: string
  readonly name: string
  readonly frontBackground: string | null
  readonly backBackground: string | null
  readonly isDefault: boolean
  readonly createdAt: string
}
