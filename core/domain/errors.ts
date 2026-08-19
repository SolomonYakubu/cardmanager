/**
 * Domain errors.
 *
 * Every failure carries a stable, machine-readable `code` (spec §10: failures
 * must be specific and named, never a generic error). Services map these codes
 * onto card failure-states and audit-log entries. This module is a leaf — it
 * imports nothing from the domain, so anything may depend on it.
 */

export type DomainErrorCode =
  | 'INVALID_STATUS_TRANSITION'
  | 'PATIENT_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'ACTIVE_CARD_NOT_FOUND'
  | 'HOSPITAL_NO_MISMATCH'
  | 'NFC_ENCODING_FAILED'
  | 'NFC_VERIFICATION_FAILED'
  | 'PRINT_FAILED'
  | 'PRINT_VERIFICATION_FAILED'
  | 'ORIGINALITY_REJECTED'
  | 'HARDWARE_ERROR'
  | 'VALIDATION_ERROR'

export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
    this.code = code
  }
}

/** Thrown when a lookup by id/hospital_no/card_id finds nothing. */
export class NotFoundError extends DomainError {}

/** Thrown when a state-machine guard rejects a transition (see card-status). */
export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_STATUS_TRANSITION', `Illegal card status transition: ${from} -> ${to}`)
  }
}

/** Type guard so callers can branch on domain errors without `any`. */
export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError
}
