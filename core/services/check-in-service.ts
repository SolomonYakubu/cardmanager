/**
 * Check-in service (spec §8).
 *
 * At the check-in desk a patient presents their card. Two channels are read:
 *   - NFC chip  → card_id + hospital_no  (identifies the card)
 *   - barcode   → originality_code       (proves the card is genuine)
 *
 * The flow, in order, is:
 *   1. Read the chip and look up the card by its card_id.
 *   2. Cross-check the hospital_no on the chip against the card record.
 *   3. Confirm the card is ACTIVE — this is the backstop against a
 *      photographed/duplicated barcode: a LOST/VOID/REPLACED/EXPIRED card is
 *      rejected here even though its originality_code still recomputes (spec §1
 *      duplication caveat, spec §8).
 *   4. Optionally scan the barcode and recompute the originality_code.
 *   5. On success, return the patient + EMR deep link so the desk can open the
 *      chart, and log CARD_CHECKED_IN.
 *
 * Every outcome — success or rejection — is a returned {@link CheckInResult}, not
 * a thrown error: a bad tap or forged card is an ordinary event at a busy desk,
 * and the operator UI always needs something displayable. Only genuine wiring
 * bugs (a missing dependency) would throw.
 */

import type { Card, Patient } from '../domain/models'
import { isActive } from '../domain/card-status'
import { OriginalityCode } from '../domain/ids'
import type { DomainErrorCode } from '../domain/errors'
import type { NfcAdapter, NfcPayload } from '../ports/nfc'
import type { BarcodeScanner } from '../ports/barcode'
import type { CardRepository, PatientRepository } from '../ports/repositories'
import type { OriginalitySigner } from '../crypto/originality'
import type { AuditLog } from './audit-log'
import { buildEmrLink, DEFAULT_EMR_LINK_BASE } from './emr-link'

export interface CheckInInput {
  readonly operatorId?: string
  readonly stationId?: string
  /** Also scan + verify the printed barcode (default true). */
  readonly verifyOriginality?: boolean
}

export interface CheckInResult {
  readonly ok: boolean
  readonly card?: Card
  readonly patient?: Patient
  /** Present on success so the desk can open the chart directly. */
  readonly emrLink?: string
  /** Present on rejection: a stable, machine-readable reason. */
  readonly reason?: DomainErrorCode
  /** Human-facing detail for the operator. */
  readonly detail?: string
}

export interface CheckInServiceDeps {
  readonly cards: CardRepository
  readonly patients: PatientRepository
  readonly audit: AuditLog
  readonly nfc: NfcAdapter
  readonly barcode: BarcodeScanner
  readonly originality: OriginalitySigner
  readonly emrLinkBase?: string
}

export class CheckInService {
  readonly #cards: CardRepository
  readonly #patients: PatientRepository
  readonly #audit: AuditLog
  readonly #nfc: NfcAdapter
  readonly #barcode: BarcodeScanner
  readonly #originality: OriginalitySigner
  readonly #emrLinkBase: string

  constructor(deps: CheckInServiceDeps) {
    this.#cards = deps.cards
    this.#patients = deps.patients
    this.#audit = deps.audit
    this.#nfc = deps.nfc
    this.#barcode = deps.barcode
    this.#originality = deps.originality
    this.#emrLinkBase = deps.emrLinkBase ?? DEFAULT_EMR_LINK_BASE
  }

  async checkIn(input: CheckInInput = {}): Promise<CheckInResult> {
    const verifyOriginality = input.verifyOriginality ?? true

    // 1. Read the chip.
    let chip: NfcPayload
    try {
      await this.#nfc.waitForCard()
      chip = await this.#nfc.read()
    } catch (err) {
      return reject('HARDWARE_ERROR', detailOf(err))
    }

    // 2. Identify the card.
    const card = await this.#cards.findByCardId(chip.cardId)
    if (!card) {
      return reject('ACTIVE_CARD_NOT_FOUND', `no card on file for card_id ${chip.cardId}`)
    }

    // 3. Cross-check hospital_no (chip vs record).
    if (card.hospitalNo !== chip.hospitalNo) {
      return reject(
        'HOSPITAL_NO_MISMATCH',
        `chip hospital_no ${chip.hospitalNo} does not match card record ${card.hospitalNo}`,
        card,
      )
    }

    // 4. Backstop: only an ACTIVE card checks in.
    if (!isActive(card.status)) {
      return reject('ACTIVE_CARD_NOT_FOUND', `card is ${card.status}, not ACTIVE`, card)
    }

    // 5. Originality (genuineness) check.
    if (verifyOriginality) {
      let scanned: string
      try {
        scanned = await this.#barcode.scan()
      } catch (err) {
        return reject('HARDWARE_ERROR', detailOf(err), card)
      }
      if (!this.#originality.verify(card.cardId, OriginalityCode(scanned))) {
        await this.#audit.record({
          cardRecordId: card.id,
          type: 'ORIGINALITY_REJECTED',
          operatorId: input.operatorId,
          stationId: input.stationId,
          detail: 'barcode failed originality verification at check-in',
        })
        return reject('ORIGINALITY_REJECTED', 'card failed the originality (genuineness) check', card)
      }
      await this.#audit.record({
        cardRecordId: card.id,
        type: 'ORIGINALITY_VERIFIED',
        operatorId: input.operatorId,
        stationId: input.stationId,
      })
    }

    // 6. Success.
    const patient = await this.#patients.findById(card.patientId)
    await this.#audit.record({
      cardRecordId: card.id,
      type: 'CARD_CHECKED_IN',
      operatorId: input.operatorId,
      stationId: input.stationId,
    })
    return {
      ok: true,
      card,
      patient: patient ?? undefined,
      emrLink: patient ? buildEmrLink(this.#emrLinkBase, patient) : undefined,
    }
  }
}

function reject(reason: DomainErrorCode, detail: string, card?: Card): CheckInResult {
  return { ok: false, reason, detail, card }
}

function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
