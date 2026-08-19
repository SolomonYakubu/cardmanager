/**
 * Presentation helpers for the operator console.
 *
 * Pure functions and lookup tables that map core domain values onto the labels,
 * tones, and one-line summaries the UI renders. Kept framework-free (no JSX, no
 * React) so the components stay thin: they arrange these outputs, they don't
 * compute them.
 */

import { isActive, isTerminal, type CardStatus } from '../../core/domain/card-status'
import type { CardEventType } from '../../core/domain/events'
import type { Card, Patient } from '../../core/domain/models'
import type { IssuanceResult } from '../../core/services/issuance-service'

/** Visual weight for a status badge; the badge component maps this to colors. */
export type Tone = 'active' | 'progress' | 'failure' | 'lost' | 'expired' | 'void' | 'replaced'

export const STATUS_META: Record<CardStatus, { label: string; tone: Tone }> = {
  RESERVED: { label: 'Reserved', tone: 'progress' },
  NFC_ENCODED: { label: 'NFC encoded', tone: 'progress' },
  NFC_VERIFIED: { label: 'NFC verified', tone: 'progress' },
  PRINTED: { label: 'Printed', tone: 'progress' },
  PRINTED_VERIFIED: { label: 'Print verified', tone: 'progress' },
  ACTIVE: { label: 'Active', tone: 'active' },
  NFC_ENCODING_FAILED: { label: 'NFC failed', tone: 'failure' },
  PRINT_FAILED: { label: 'Print failed', tone: 'failure' },
  LOST: { label: 'Lost', tone: 'lost' },
  EXPIRED: { label: 'Expired', tone: 'expired' },
  VOID: { label: 'Void', tone: 'void' },
  REPLACED: { label: 'Replaced', tone: 'replaced' },
}

export const EVENT_LABEL: Record<CardEventType, string> = {
  CARD_RESERVED: 'Reserved',
  NFC_ENCODED: 'NFC encoded',
  NFC_VERIFIED: 'NFC verified',
  NFC_ENCODING_FAILED: 'NFC encoding failed',
  CARD_PRINTED: 'Printed',
  PRINT_VERIFIED: 'Print verified',
  PRINT_FAILED: 'Print failed',
  CARD_ACTIVATED: 'Activated',
  CARD_CHECKED_IN: 'Checked in',
  ORIGINALITY_VERIFIED: 'Originality verified',
  ORIGINALITY_REJECTED: 'Originality rejected',
  CARD_REPORTED_LOST: 'Reported lost',
  CARD_EXPIRED: 'Expired',
  CARD_VOIDED: 'Voided',
  CARD_REPLACED: 'Replaced',
}

/** Timeline dot color for an audit event: failures stand out in red. */
export type EventTone = 'good' | 'bad' | 'neutral'

const FAILURE_EVENTS: ReadonlySet<CardEventType> = new Set([
  'NFC_ENCODING_FAILED',
  'PRINT_FAILED',
  'ORIGINALITY_REJECTED',
])

const SUCCESS_EVENTS: ReadonlySet<CardEventType> = new Set([
  'NFC_VERIFIED',
  'PRINT_VERIFIED',
  'CARD_ACTIVATED',
  'CARD_CHECKED_IN',
  'ORIGINALITY_VERIFIED',
])

export function eventTone(type: CardEventType): EventTone {
  if (FAILURE_EVENTS.has(type)) return 'bad'
  if (SUCCESS_EVENTS.has(type)) return 'good'
  return 'neutral'
}



/** The actions an operator may take on a card, gated by its current status. */
export type CardAction = 'resume' | 'reportLost' | 'reissue' | 'void'

/**
 * Which actions are offered for a card in a given status. Mirrors the state
 * machine (core/domain/card-status): active cards are used or retired, terminal
 * cards are done, mid-issuance/failure cards resume, lost/expired cards reissue.
 */
export function actionsFor(status: CardStatus): CardAction[] {
  if (isActive(status)) return ['reportLost', 'reissue', 'void']
  if (isTerminal(status)) return []
  if (status === 'LOST' || status === 'EXPIRED') return ['reissue', 'void']
  return ['resume', 'void']
}

/** A normalized outcome message for the console's banner. */
export interface Banner {
  readonly tone: 'ok' | 'warn' | 'error'
  readonly title: string
  readonly lines: string[]
}

export function describeIssuance(result: IssuanceResult): Banner {
  if (result.ok) {
    return {
      tone: 'ok',
      title: 'Card issued and activated',
      lines: [`Card ${shortId(result.card.cardId)} is now ACTIVE.`],
    }
  }
  const at = result.failedAt ? STATUS_META[result.failedAt].label : 'an earlier step'
  return {
    tone: 'warn',
    title: `Issuance stopped at ${at}`,
    lines: ['Nothing was lost — press Resume issue to retry from the last good step.'],
  }
}

export function formatTime(iso: string): string {
  // Renderer-side formatting only; the domain never inlines Date (see Clock port).
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Compact a long identifier (e.g. a UUID card_id) for display. */
export function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…`
}

/**
 * Unwrap the message Electron wraps around a thrown IPC handler error
 * ("Error occurred in handler for 'chan': <message>") so operators see the
 * domain message, not the plumbing.
 */
export function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const match = msg.match(/Error occurred in handler for '[^']*':\s*([\s\S]*)$/)
  return match ? match[1] : msg
}

/** Convenience for the header patient line. */
export function patientSummary(patient: Patient): string {
  return `${patient.name} · ${patient.hospitalNo}`
}

/** Convenience for a card's issued-at line. */
export function issuedLine(card: Card): string {
  return card.issuedAt ? `Issued ${formatTime(card.issuedAt)}` : 'Not yet issued'
}
