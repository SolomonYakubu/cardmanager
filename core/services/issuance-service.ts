/**
 * Issuance service (spec §7, §10).
 *
 * Drives a blank card through the full issuance pipeline:
 *
 *   RESERVED
 *     → (write chip)     NFC_ENCODED
 *     → (read-back)      NFC_VERIFIED
 *     → (print)          PRINTED
 *     → (scan barcode)   PRINTED_VERIFIED
 *     → (commit)         ACTIVE
 *
 * Two disciplines from the spec are baked in here and are the reason this reads
 * the way it does:
 *
 *  1. Verify before advancing. Every hardware operation (NFC write, print) is
 *     followed by an independent verification (read-back, barcode scan +
 *     originality recompute) BEFORE the status moves forward. We never trust the
 *     "write" call alone.
 *
 *  2. One persisted step at a time, resumable. Each step saves the card and
 *     writes exactly one event. So a crash or hardware fault leaves the card in
 *     a known status, and calling {@link IssuanceService.issue} again picks up
 *     from wherever it stopped — including retrying a *_FAILED state. `issue`
 *     is therefore idempotent and safe to re-run.
 *
 * The service depends only on ports (repositories, adapters, signer, clock, id
 * generator), never on concrete hardware or storage — so the same logic runs
 * against fakes in tests and real devices in production.
 */

import type { Card } from '../domain/models'
import type { CardStatus } from '../domain/card-status'
import { assertTransition } from '../domain/card-status'
import type { CardEventType } from '../domain/events'
import { CardRecordId, OriginalityCode, PatientId } from '../domain/ids'
import { NotFoundError } from '../domain/errors'
import type { CardArtwork } from '../ports/printer'
import type { PrinterAdapter } from '../ports/printer'
import type { NfcAdapter } from '../ports/nfc'
import type { BarcodeScanner } from '../ports/barcode'
import type { CardRepository, PatientRepository } from '../ports/repositories'
import type { OriginalitySigner } from '../crypto/originality'
import type { Clock, IdGenerator } from '../ports/system'
import type { AuditLog } from './audit-log'
import { buildEmrLink, DEFAULT_EMR_LINK_BASE } from './emr-link'

/** Who/where an operation happened — recorded on every event. Also includes custom backgrounds for this run. */
export interface IssuanceContext {
  readonly operatorId?: string
  readonly stationId?: string
  readonly frontBackground?: string | null
  readonly backBackground?: string | null
}

/** Input for reserving a new card for a patient. */
export interface ReserveInput extends IssuanceContext {
  readonly patientId: string
}

/** Outcome of an issuance run: the final card and whether it reached ACTIVE. */
export interface IssuanceResult {
  readonly card: Card
  /** True once the card is ACTIVE. */
  readonly ok: boolean
  /** Set when the run stopped in a failure state, naming that state. */
  readonly failedAt?: CardStatus
}

export interface IssuanceServiceDeps {
  readonly cards: CardRepository
  readonly patients: PatientRepository
  readonly audit: AuditLog
  readonly nfc: NfcAdapter
  readonly printer: PrinterAdapter
  readonly barcode: BarcodeScanner
  readonly originality: OriginalitySigner
  readonly clock: Clock
  readonly ids: IdGenerator
  /** Prefix used to build the EMR deep link written into the QR channel. */
  readonly emrLinkBase?: string
}

export class IssuanceService {
  readonly #cards: CardRepository
  readonly #patients: PatientRepository
  readonly #audit: AuditLog
  readonly #nfc: NfcAdapter
  readonly #printer: PrinterAdapter
  readonly #barcode: BarcodeScanner
  readonly #originality: OriginalitySigner
  readonly #clock: Clock
  readonly #ids: IdGenerator
  readonly #emrLinkBase: string

  constructor(deps: IssuanceServiceDeps) {
    this.#cards = deps.cards
    this.#patients = deps.patients
    this.#audit = deps.audit
    this.#nfc = deps.nfc
    this.#printer = deps.printer
    this.#barcode = deps.barcode
    this.#originality = deps.originality
    this.#clock = deps.clock
    this.#ids = deps.ids
    this.#emrLinkBase = deps.emrLinkBase ?? DEFAULT_EMR_LINK_BASE
  }

  /**
   * Reserve a fresh card for a patient: mint a card_id + originality_code and
   * persist a RESERVED record. This is the only step that creates the record;
   * everything after it is a transition performed by {@link issue}.
   */
  async reserve(input: ReserveInput): Promise<Card> {
    const patient = await this.#patients.findById(PatientId(input.patientId))
    if (!patient) {
      throw new NotFoundError('PATIENT_NOT_FOUND', `patient ${input.patientId} not found`)
    }

    const cardId = this.#ids.newCardId()
    const now = this.#clock.nowIso()
    const card: Card = {
      id: CardRecordId(this.#ids.newId()),
      cardId,
      patientId: patient.id,
      hospitalNo: patient.hospitalNo,
      nfcUid: null,
      originalityCode: this.#originality.sign(cardId),
      status: 'RESERVED',
      issuedAt: null,
      issuedByOperatorId: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    }

    await this.#cards.create(card)
    await this.#audit.record({
      cardRecordId: card.id,
      type: 'CARD_RESERVED',
      operatorId: input.operatorId,
      stationId: input.stationId,
    })
    return card
  }

  /** Reserve then run the full pipeline in one call (the happy-path entry). */
  async issueForPatient(input: ReserveInput): Promise<IssuanceResult> {
    const card = await this.reserve(input)
    return this.issue(card.id, input)
  }

  /**
   * Advance a card as far toward ACTIVE as it will go, resuming from its current
   * status. Each step verifies before it advances; the first failure stops the
   * run and leaves the card in a named *_FAILED state that a later call can
   * retry. Safe to call repeatedly.
   */
  async issue(cardRecordId: CardRecordId, ctx: IssuanceContext = {}): Promise<IssuanceResult> {
    let card = await this.#requireCard(cardRecordId)

    // The pipeline is a sequence of guarded steps. Each `if` inspects the
    // *current* status (updated by the previous step), so a fresh RESERVED card
    // cascades through all of them, while a resumed card enters at its step.

    // Step 1a — encode the chip. Entry point for a new card and for an NFC retry.
    if (card.status === 'RESERVED' || card.status === 'NFC_ENCODING_FAILED') {
      card = await this.#encode(card, ctx)
      if (card.status === 'NFC_ENCODING_FAILED') return this.#stopped(card)
    }

    // Step 1b — read-back verify (verify-before-advance for the NFC write).
    if (card.status === 'NFC_ENCODED') {
      card = await this.#verifyNfc(card, ctx)
      if (card.status === 'NFC_ENCODING_FAILED') return this.#stopped(card)
    }

    // Step 2 — print. Entry point for a print retry (PRINT_FAILED → PRINTED).
    if (card.status === 'NFC_VERIFIED' || card.status === 'PRINT_FAILED') {
      card = await this.#print(card, ctx)
      if (card.status === 'PRINT_FAILED') return this.#stopped(card)
    }

    // Step 3 — scan the printed barcode and recompute originality (verify-before-advance for the print).
    if (card.status === 'PRINTED') {
      card = await this.#verifyPrint(card, ctx)
      if (card.status === 'PRINT_FAILED') return this.#stopped(card)
    }

    // Step 4 — commit: the card is now genuine and usable.
    if (card.status === 'PRINTED_VERIFIED') {
      card = await this.#activate(card, ctx)
    }

    return { card, ok: card.status === 'ACTIVE' }
  }

  // ── Steps ────────────────────────────────────────────────────────────────
  // Each step performs one hardware action, then advances to a success status
  // or, on any thrown/failed outcome, to the matching named failure status.

  async #encode(card: Card, ctx: IssuanceContext): Promise<Card> {
    try {
      // Detect a chip and bind its UID (reuse the bound UID on a retry).
      const nfcUid = card.nfcUid ?? (await this.#nfc.waitForCard())
      await this.#nfc.write({ cardId: card.cardId, hospitalNo: card.hospitalNo })
      return this.#advance(card, 'NFC_ENCODED', 'NFC_ENCODED', ctx, { cardPatch: { nfcUid } })
    } catch (err) {
      return this.#advance(card, 'NFC_ENCODING_FAILED', 'NFC_ENCODING_FAILED', ctx, {
        detail: detailOf(err),
      })
    }
  }

  async #verifyNfc(card: Card, ctx: IssuanceContext): Promise<Card> {
    try {
      const ok = await this.#nfc.verify({ cardId: card.cardId, hospitalNo: card.hospitalNo })
      if (!ok) {
        return this.#advance(card, 'NFC_ENCODING_FAILED', 'NFC_ENCODING_FAILED', ctx, {
          detail: 'read-back mismatch: chip does not hold the expected card_id/hospital_no',
        })
      }
      return this.#advance(card, 'NFC_VERIFIED', 'NFC_VERIFIED', ctx)
    } catch (err) {
      return this.#advance(card, 'NFC_ENCODING_FAILED', 'NFC_ENCODING_FAILED', ctx, {
        detail: detailOf(err),
      })
    }
  }

  async #print(card: Card, ctx: IssuanceContext): Promise<Card> {
    try {
      const artwork = await this.#renderArtwork(card, ctx)
      const result = await this.#printer.print({ cardRecordId: card.id, artwork })
      if (!result.accepted) {
        return this.#advance(card, 'PRINT_FAILED', 'PRINT_FAILED', ctx, {
          detail: 'printer refused the job',
        })
      }
      return this.#advance(card, 'PRINTED', 'CARD_PRINTED', ctx)
    } catch (err) {
      return this.#advance(card, 'PRINT_FAILED', 'PRINT_FAILED', ctx, { detail: detailOf(err) })
    }
  }

  async #verifyPrint(card: Card, ctx: IssuanceContext): Promise<Card> {
    try {
      const scanned = await this.#barcode.scan()
      const genuine = this.#originality.verify(card.cardId, OriginalityCode(scanned))
      if (!genuine) {
        // The printed barcode didn't recompute to a valid originality code.
        await this.#audit.record({
          cardRecordId: card.id,
          type: 'ORIGINALITY_REJECTED',
          operatorId: ctx.operatorId,
          stationId: ctx.stationId,
          detail: 'scanned barcode failed originality verification',
        })
        return this.#advance(card, 'PRINT_FAILED', 'PRINT_FAILED', ctx, {
          detail: 'printed barcode failed originality check',
        })
      }
      return this.#advance(card, 'PRINTED_VERIFIED', 'PRINT_VERIFIED', ctx)
    } catch (err) {
      return this.#advance(card, 'PRINT_FAILED', 'PRINT_FAILED', ctx, { detail: detailOf(err) })
    }
  }

  async #activate(card: Card, ctx: IssuanceContext): Promise<Card> {
    return this.#advance(card, 'ACTIVE', 'CARD_ACTIVATED', ctx, {
      cardPatch: {
        issuedAt: this.#clock.nowIso(),
        issuedByOperatorId: ctx.operatorId ?? null,
      },
    })
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * The single place a card's status changes: assert the transition is legal,
   * persist the updated record, then write exactly one event. Doing all three
   * together is what makes every step atomic-from-the-outside and auditable.
   */
  async #advance(
    card: Card,
    to: CardStatus,
    eventType: CardEventType,
    ctx: IssuanceContext,
    opts: { cardPatch?: Partial<Card>; detail?: string } = {},
  ): Promise<Card> {
    assertTransition(card.status, to)
    const updated: Card = {
      ...card,
      ...opts.cardPatch,
      status: to,
      updatedAt: this.#clock.nowIso(),
    }
    await this.#cards.save(updated)
    await this.#audit.record({
      cardRecordId: updated.id,
      type: eventType,
      operatorId: ctx.operatorId,
      stationId: ctx.stationId,
      detail: opts.detail,
    })
    return updated
  }

  async #renderArtwork(card: Card, ctx: IssuanceContext): Promise<CardArtwork> {
    const patient = await this.#patients.findById(card.patientId)
    if (!patient) {
      throw new NotFoundError('PATIENT_NOT_FOUND', `patient ${card.patientId} not found`)
    }
    return {
      patientName: patient.name,
      hospitalNo: card.hospitalNo,
      walletNo: patient.walletNo ?? undefined,
      emrLink: buildEmrLink(this.#emrLinkBase, patient),
      barcodeValue: card.originalityCode,
      frontBackground: ctx.frontBackground ?? undefined,
      backBackground: ctx.backBackground ?? undefined,
    }
  }

  async #requireCard(id: CardRecordId): Promise<Card> {
    const card = await this.#cards.findById(id)
    if (!card) throw new NotFoundError('CARD_NOT_FOUND', `card ${id} not found`)
    return card
  }

  #stopped(card: Card): IssuanceResult {
    return { card, ok: false, failedAt: card.status }
  }
}

/** Extract an operator-facing detail string from an unknown thrown value. */
function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
