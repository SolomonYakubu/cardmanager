/**
 * Card events — the append-only audit trail (spec §6, §10).
 *
 * Every meaningful thing that happens to a card writes one event: what, when,
 * which station/operator, and error detail on failure. This gives a full,
 * reconstructable history per card without overloading the Card record itself.
 */

import type { CardRecordId } from './ids'

export type CardEventType =
  // Issuance (spec §7)
  | 'CARD_RESERVED'
  | 'NFC_ENCODED'
  | 'NFC_VERIFIED'
  | 'NFC_ENCODING_FAILED'
  | 'CARD_PRINTED'
  | 'PRINT_VERIFIED'
  | 'PRINT_FAILED'
  | 'CARD_ACTIVATED'
  // Check-in & verification (spec §8)
  | 'CARD_CHECKED_IN'
  | 'ORIGINALITY_VERIFIED'
  | 'ORIGINALITY_REJECTED'
  // Lifecycle (spec §9)
  | 'CARD_REPORTED_LOST'
  | 'CARD_EXPIRED'
  | 'CARD_VOIDED'
  | 'CARD_REPLACED'

export interface CardEvent {
  readonly id: string
  readonly cardRecordId: CardRecordId
  readonly type: CardEventType
  /** ISO-8601 timestamp, supplied by the Clock port (never `Date.now()` inline). */
  readonly at: string
  readonly operatorId?: string
  readonly stationId?: string
  /** Human-meaningful detail — required for failures (spec §10). */
  readonly detail?: string
}

/** Fields the caller supplies; id/at are stamped by the audit log. */
export type NewCardEvent = Omit<CardEvent, 'id' | 'at'>
