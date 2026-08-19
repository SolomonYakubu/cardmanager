import type { NfcAdapter, NfcPayload, NfcState, NfcStatus } from '../../ports/nfc'
import { CardId, type NfcUid } from '../../domain/ids'
import { DomainError } from '../../domain/errors'

export interface FakeNfcOptions {
  /** UID of a chip sitting at the station (null = none present). */
  presentUid?: NfcUid | null
  /** Make `write` throw, simulating an encode failure (spec §10). */
  failWrite?: boolean
  /** Let `write` "succeed" but store wrong data, so `verify` catches it. */
  corruptWrite?: boolean
}

/**
 * Simulated NTAG-tier reader/encoder. Stores whatever is written so `read` and
 * `verify` behave like a real chip. Failure flags are public and mutable so a
 * test can fail the first attempt and succeed on retry.
 */
export class FakeNfcAdapter implements NfcAdapter {
  #state: NfcState = 'OFFLINE'
  #presentUid: NfcUid | null
  #stored: NfcPayload | null = null
  failWrite: boolean
  corruptWrite: boolean

  constructor(opts: FakeNfcOptions = {}) {
    this.#presentUid = opts.presentUid ?? null
    this.failWrite = opts.failWrite ?? false
    this.corruptWrite = opts.corruptWrite ?? false
  }

  /** Test/dev helper: present a fresh blank chip at the station. */
  present(uid: NfcUid): void {
    this.#presentUid = uid
    this.#stored = null
  }

  async connect(): Promise<void> {
    this.#state = 'READY'
  }

  async getStatus(): Promise<NfcStatus> {
    return { state: this.#state }
  }

  async waitForCard(): Promise<NfcUid> {
    if (!this.#presentUid) throw new DomainError('HARDWARE_ERROR', 'no NFC chip present at station')
    return this.#presentUid
  }

  async read(): Promise<NfcPayload> {
    if (!this.#stored) throw new DomainError('HARDWARE_ERROR', 'chip is blank')
    return this.#stored
  }

  async write(payload: NfcPayload): Promise<void> {
    if (this.failWrite) {
      throw new DomainError('NFC_ENCODING_FAILED', 'simulated NFC write failure')
    }
    this.#stored = this.corruptWrite
      ? { ...payload, cardId: CardId(`${payload.cardId}-corrupt`) }
      : payload
  }

  async verify(expected: NfcPayload): Promise<boolean> {
    if (!this.#stored) return false
    return this.#stored.cardId === expected.cardId && this.#stored.hospitalNo === expected.hospitalNo
  }

  async disconnect(): Promise<void> {
    this.#state = 'OFFLINE'
  }
}
