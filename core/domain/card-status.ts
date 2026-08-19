/**
 * Card status state machine (spec §6, §7, §10).
 *
 * The status advances ONE confirmed step at a time. Each hardware step has a
 * matching failure state, and a failure state can be retried back into the
 * flow. Because transitions are explicit, a crash mid-issuance leaves a known,
 * resumable status (spec §10) and illegal jumps (e.g. RESERVED -> ACTIVE) are
 * impossible.
 */

import { InvalidStatusTransitionError } from './errors'

export const CARD_STATUSES = [
  // Issuance happy path
  'RESERVED',
  'NFC_ENCODED',
  'NFC_VERIFIED',
  'PRINTED',
  'PRINTED_VERIFIED',
  'ACTIVE',
  // Named failure states (spec §10)
  'NFC_ENCODING_FAILED',
  'PRINT_FAILED',
  // Lifecycle end states
  'LOST',
  'VOID',
  'EXPIRED',
  'REPLACED',
] as const

export type CardStatus = (typeof CARD_STATUSES)[number]

/** Statuses from which no further transition is allowed. */
const TERMINAL: ReadonlySet<CardStatus> = new Set(['VOID', 'REPLACED'])

/** Failure statuses produced by a failed-and-verified hardware step. */
const FAILURE: ReadonlySet<CardStatus> = new Set(['NFC_ENCODING_FAILED', 'PRINT_FAILED'])

/**
 * The complete transition table. A status maps to the set of statuses it may
 * legally move to. Anything not listed is rejected.
 */
const ALLOWED: Readonly<Record<CardStatus, readonly CardStatus[]>> = {
  RESERVED: ['NFC_ENCODED', 'NFC_ENCODING_FAILED', 'VOID'],
  NFC_ENCODED: ['NFC_VERIFIED', 'NFC_ENCODING_FAILED', 'VOID'],
  NFC_VERIFIED: ['PRINTED', 'PRINT_FAILED', 'VOID'],
  PRINTED: ['PRINTED_VERIFIED', 'PRINT_FAILED', 'VOID'],
  PRINTED_VERIFIED: ['ACTIVE', 'VOID'],
  ACTIVE: ['LOST', 'EXPIRED', 'REPLACED', 'VOID'],
  // Failure states retry back into the flow, or are abandoned.
  NFC_ENCODING_FAILED: ['NFC_ENCODED', 'NFC_ENCODING_FAILED', 'VOID'],
  PRINT_FAILED: ['PRINTED', 'PRINT_FAILED', 'VOID'],
  // Lost/expired cards can be superseded by a reissue (spec §9) or voided.
  LOST: ['REPLACED', 'VOID'],
  EXPIRED: ['REPLACED', 'VOID'],
  // Terminal.
  VOID: [],
  REPLACED: [],
}

export function isTerminal(status: CardStatus): boolean {
  return TERMINAL.has(status)
}

export function isFailure(status: CardStatus): boolean {
  return FAILURE.has(status)
}

/** A fully issued, usable card. */
export function isActive(status: CardStatus): boolean {
  return status === 'ACTIVE'
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED[from].includes(to)
}

/** Throws {@link InvalidStatusTransitionError} unless the move is legal. */
export function assertTransition(from: CardStatus, to: CardStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to)
  }
}

/** Legal next statuses from `from` (useful for UIs and tests). */
export function nextStatuses(from: CardStatus): readonly CardStatus[] {
  return ALLOWED[from]
}
