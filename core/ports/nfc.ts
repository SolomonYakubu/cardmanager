/**
 * NFC port (spec §4 — NFC side, chip-family-agnostic).
 *
 * Mirrors the spec's interface: connect / wait for card / read / write /
 * verify (read-back+compare) / disconnect. The default implementation targets
 * the NTAG tier; an authenticated-chip adapter (Path B) implements the same
 * interface later with no change above this line.
 */

import type { CardId, HospitalNo, NfcUid } from '../domain/ids'

export type NfcState = 'READY' | 'BUSY' | 'ERROR' | 'OFFLINE'

export interface NfcStatus {
  readonly state: NfcState
  readonly detail?: string
}

/** The two data records written to the chip (spec §1): card_id + hospital_no. */
export interface NfcPayload {
  readonly cardId: CardId
  readonly hospitalNo: HospitalNo
}

export interface NfcAdapter {
  connect(): Promise<void>
  getStatus(): Promise<NfcStatus>
  /** Block until a chip is present; resolves with its UID (bound at issuance). */
  waitForCard(options?: { timeoutMs?: number }): Promise<NfcUid>
  read(): Promise<NfcPayload>
  write(payload: NfcPayload): Promise<void>
  /**
   * Read back what was just written and compare (spec §4, §10). Returning the
   * comparison here — rather than trusting `write` — is the verify-before-advance
   * discipline baked into the contract.
   */
  verify(expected: NfcPayload): Promise<boolean>
  disconnect(): Promise<void>
}
