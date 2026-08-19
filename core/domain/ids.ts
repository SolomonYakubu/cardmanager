/**
 * Identifier model (spec §1).
 *
 * Three identifiers with three distinct jobs — and they must never be confused
 * for one another. We encode that discipline in the type system with *branded*
 * strings: a `CardId` and a `HospitalNo` are both strings at runtime, but the
 * compiler refuses to assign one where the other is expected.
 *
 * Each identifier has a companion constructor of the same name that validates
 * and brands a raw string, e.g. `HospitalNo('H-000123')`.
 */

import { DomainError } from './errors'

// A nominal ("branded") type: the phantom `__brand` field exists only in the
// type system, so two brands over `string` are mutually incompatible.
type Brand<T, B extends string> = T & { readonly __brand: B }

export type PatientId = Brand<string, 'PatientId'>
export type CardRecordId = Brand<string, 'CardRecordId'>
export type HospitalNo = Brand<string, 'HospitalNo'>
export type CardId = Brand<string, 'CardId'>
export type OriginalityCode = Brand<string, 'OriginalityCode'>
export type NfcUid = Brand<string, 'NfcUid'>

function nonEmpty(label: string, value: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION_ERROR', `${label} must be a non-empty string`)
  }
  return value.trim()
}

// Constructor functions share the name of their type (a value + type pairing),
// so `HospitalNo` reads naturally both as an annotation and as a smart ctor.
export const PatientId = (v: string): PatientId => nonEmpty('PatientId', v) as PatientId
export const CardRecordId = (v: string): CardRecordId => nonEmpty('CardRecordId', v) as CardRecordId
export const HospitalNo = (v: string): HospitalNo => nonEmpty('hospital_no', v) as HospitalNo
export const CardId = (v: string): CardId => nonEmpty('card_id', v) as CardId
export const OriginalityCode = (v: string): OriginalityCode =>
  nonEmpty('originality_code', v) as OriginalityCode
export const NfcUid = (v: string): NfcUid => nonEmpty('nfc_uid', v) as NfcUid
