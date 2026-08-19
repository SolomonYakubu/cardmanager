/**
 * Card lifecycle service (spec §9).
 *
 * The post-issuance transitions that take a card out of, or replace it within,
 * active service:
 *
 *   reportLost  ACTIVE                     → LOST
 *   expire      ACTIVE                     → EXPIRED
 *   void        any non-terminal           → VOID   (mistake / decommission)
 *   reissue     ACTIVE | LOST | EXPIRED     → REPLACED, and mints a fresh
 *               RESERVED card for the same patient (new card_id, new
 *               originality_code — spec §1: card_id changes on every reissue).
 *
 * Every transition goes through the same guard-save-log path as issuance, so an
 * illegal move (e.g. voiding an already-terminal card, reissuing an un-issued
 * one) is rejected by the state machine rather than silently applied.
 */

import type { Card } from '../domain/models'
import type { CardStatus } from '../domain/card-status'
import { assertTransition } from '../domain/card-status'
import type { CardEventType } from '../domain/events'
import type { CardRecordId } from '../domain/ids'
import { NotFoundError } from '../domain/errors'
import type { CardRepository } from '../ports/repositories'
import type { Clock } from '../ports/system'
import type { AuditLog } from './audit-log'
import type { IssuanceService } from './issuance-service'

export interface OperationContext {
  readonly operatorId?: string
  readonly stationId?: string
}

export interface ReissueResult {
  /** The old card, now REPLACED. */
  readonly replaced: Card
  /** The new RESERVED card, ready to run through issuance. */
  readonly replacement: Card
}

export interface CardLifecycleServiceDeps {
  readonly cards: CardRepository
  readonly audit: AuditLog
  readonly clock: Clock
  /** Used to mint the replacement card during a reissue. */
  readonly issuance: IssuanceService
}

export class CardLifecycleService {
  readonly #cards: CardRepository
  readonly #audit: AuditLog
  readonly #clock: Clock
  readonly #issuance: IssuanceService

  constructor(deps: CardLifecycleServiceDeps) {
    this.#cards = deps.cards
    this.#audit = deps.audit
    this.#clock = deps.clock
    this.#issuance = deps.issuance
  }

  /** ACTIVE → LOST. */
  async reportLost(id: CardRecordId, ctx: OperationContext = {}): Promise<Card> {
    const card = await this.#requireCard(id)
    return this.#transition(card, 'LOST', 'CARD_REPORTED_LOST', ctx)
  }

  /** ACTIVE → EXPIRED. */
  async expire(id: CardRecordId, ctx: OperationContext = {}): Promise<Card> {
    const card = await this.#requireCard(id)
    return this.#transition(card, 'EXPIRED', 'CARD_EXPIRED', ctx)
  }

  /** any non-terminal → VOID (operator mistake, decommission). */
  async void(id: CardRecordId, ctx: OperationContext = {}, reason?: string): Promise<Card> {
    const card = await this.#requireCard(id)
    return this.#transition(card, 'VOID', 'CARD_VOIDED', ctx, reason)
  }

  /**
   * Supersede a card: mint a fresh replacement for the same patient and mark the
   * old one REPLACED. The replacement is minted first, so if reservation fails
   * the old card is left untouched.
   */
  async reissue(id: CardRecordId, ctx: OperationContext = {}): Promise<ReissueResult> {
    const old = await this.#requireCard(id)
    // Fail fast if the old card can't legally be replaced, before creating anything.
    assertTransition(old.status, 'REPLACED')

    const replacement = await this.#issuance.reserve({
      patientId: old.patientId,
      operatorId: ctx.operatorId,
      stationId: ctx.stationId,
    })
    const replaced = await this.#transition(old, 'REPLACED', 'CARD_REPLACED', ctx, `replaced by ${replacement.cardId}`)
    return { replaced, replacement }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  async #transition(
    card: Card,
    to: CardStatus,
    eventType: CardEventType,
    ctx: OperationContext,
    detail?: string,
  ): Promise<Card> {
    assertTransition(card.status, to)
    const updated: Card = { ...card, status: to, updatedAt: this.#clock.nowIso() }
    await this.#cards.save(updated)
    await this.#audit.record({
      cardRecordId: updated.id,
      type: eventType,
      operatorId: ctx.operatorId,
      stationId: ctx.stationId,
      detail,
    })
    return updated
  }

  async #requireCard(id: CardRecordId): Promise<Card> {
    const card = await this.#cards.findById(id)
    if (!card) throw new NotFoundError('CARD_NOT_FOUND', `card ${id} not found`)
    return card
  }
}
