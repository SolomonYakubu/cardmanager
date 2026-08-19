/**
 * PC/SC NFC adapter (real, NTAG-tier).
 *
 * Implements the {@link NfcAdapter} port on top of nfc-pcsc, which speaks to any
 * PC/SC-class contactless reader (ACR122U, ACR1252, uTrust, most USB "NFC
 * readers"). It encodes the two spec-mandated records — card_id and hospital_no
 * — into the tag's user memory and reads them back to verify.
 *
 * ── Why the SDK is injected, never imported at the top ──────────────────────
 * nfc-pcsc pulls in the native `@pokusew/pcsclite` binding, which is compiled
 * against Electron's ABI (NODE_MODULE_VERSION 148). It loads in the Electron
 * main process but throws ERR_DLOPEN_FAILED under plain Node — which is where
 * Vitest runs. So this module must not statically import it. Instead the runtime
 * loads it and passes it in ({@link NfcLib}); tests pass a hand-written fake.
 * That keeps the adapter fully unit-testable without any native module or
 * physical reader.
 *
 * ── On-tag format ───────────────────────────────────────────────────────────
 * Payload is UTF-8 JSON `{"c":cardId,"h":hospitalNo}`, framed with a 2-byte
 * big-endian length prefix and zero-padded to a 4-byte page boundary, written
 * from page 4 (the first user page on NTAG21x). Read reverses that: read the
 * 2-byte length, then read exactly the framed body.
 */

import type { NfcAdapter, NfcPayload, NfcState, NfcStatus } from '../../core/ports/nfc'
import { CardId, HospitalNo, NfcUid } from '../../core/domain/ids'
import { DomainError } from '../../core/domain/errors'

// ── Minimal structural types for the slice of nfc-pcsc we use ────────────────
// nfc-pcsc ships no type declarations; we describe only what we call. The
// runtime casts the loaded module to NfcLib.

export interface NfcReaderLike {
  readonly reader: { readonly name: string }
  on(event: 'card', listener: (card: { uid?: string }) => void): void
  on(event: 'card.off', listener: (card: { uid?: string }) => void): void
  on(event: 'error', listener: (err: Error) => void): void
  on(event: 'end', listener: () => void): void
  read(blockNumber: number, length: number, blockSize?: number): Promise<Buffer>
  write(blockNumber: number, data: Buffer, blockSize?: number): Promise<void>
}

export interface NfcMainLike {
  on(event: 'reader', listener: (reader: NfcReaderLike) => void): void
  on(event: 'error', listener: (err: Error) => void): void
}

export interface NfcLib {
  new (): NfcMainLike
}

export interface PcscNfcOptions {
  /** The nfc-pcsc `NFC` constructor, injected by the runtime. */
  readonly NFC: NfcLib
  /** First writable user page (NTAG21x = 4). */
  readonly userPage?: number
  /** How long waitForCard blocks for a tap before giving up. */
  readonly waitTimeoutMs?: number
}

const PAGE_SIZE = 4
const HEADER_BYTES = 2

interface Waiter {
  resolve: (uid: NfcUid) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class PcscNfcAdapter implements NfcAdapter {
  readonly #NFC: NfcLib
  readonly #userPage: number
  readonly #waitTimeoutMs: number

  #main: NfcMainLike | null = null
  #reader: NfcReaderLike | null = null
  #cardUid: NfcUid | null = null
  #lastError: string | undefined
  #busy = false
  #waiters: Waiter[] = []

  constructor(opts: PcscNfcOptions) {
    this.#NFC = opts.NFC
    this.#userPage = opts.userPage ?? 4
    this.#waitTimeoutMs = opts.waitTimeoutMs ?? 30_000
  }

  async connect(): Promise<void> {
    if (this.#main) return
    const main = new this.#NFC()
    this.#main = main
    main.on('error', (err) => {
      this.#lastError = err.message
    })
    main.on('reader', (reader) => this.#attachReader(reader))
    // Resolve immediately: a reader may appear now or be plugged in later.
    // getStatus() reflects whether one (and a card) is actually present.
  }

  #attachReader(reader: NfcReaderLike): void {
    this.#reader = reader
    this.#lastError = undefined
    reader.on('card', (card) => {
      if (!card.uid) {
        this.#lastError = 'card detected but reader did not report a UID'
        return
      }
      this.#cardUid = NfcUid(card.uid)
      this.#resolveWaiters(this.#cardUid)
    })
    reader.on('card.off', () => {
      this.#cardUid = null
    })
    reader.on('error', (err) => {
      this.#lastError = err.message
    })
    reader.on('end', () => {
      if (this.#reader === reader) {
        this.#reader = null
        this.#cardUid = null
      }
    })
  }

  #resolveWaiters(uid: NfcUid): void {
    const waiters = this.#waiters
    this.#waiters = []
    for (const w of waiters) {
      clearTimeout(w.timer)
      w.resolve(uid)
    }
  }

  async getStatus(): Promise<NfcStatus> {
    let state: NfcState
    let detail: string | undefined
    if (!this.#main) {
      state = 'OFFLINE'
    } else if (this.#lastError) {
      state = 'ERROR'
      detail = this.#lastError
    } else if (!this.#reader) {
      state = 'OFFLINE'
      detail = 'no reader connected'
    } else if (this.#busy) {
      state = 'BUSY'
    } else {
      state = 'READY'
      detail = this.#cardUid ? 'card present' : this.#reader.reader.name
    }
    return detail ? { state, detail } : { state }
  }

  async waitForCard(options?: { timeoutMs?: number }): Promise<NfcUid> {
    if (this.#cardUid) return this.#cardUid
    if (!this.#reader) {
      throw new DomainError('HARDWARE_ERROR', 'no NFC reader connected')
    }
    const timeoutMs = options?.timeoutMs ?? this.#waitTimeoutMs
    return new Promise<NfcUid>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter((w) => w.timer !== timer)
        reject(new DomainError('HARDWARE_ERROR', 'timed out waiting for a card at the reader'))
      }, timeoutMs)
      this.#waiters.push({ resolve, reject, timer })
    })
  }

  async read(): Promise<NfcPayload> {
    const reader = this.#requireCard()
    this.#busy = true
    try {
      const header = await reader.read(this.#userPage, PAGE_SIZE)
      const length = header.readUInt16BE(0)
      if (length === 0 || length > 4096) {
        throw new DomainError('HARDWARE_ERROR', 'chip holds no valid card payload')
      }
      const totalBytes = ceilToPage(HEADER_BYTES + length)
      const framed = await reader.read(this.#userPage, totalBytes)
      const json = framed.subarray(HEADER_BYTES, HEADER_BYTES + length).toString('utf8')
      return decodePayload(json)
    } catch (err) {
      throw asHardwareError(err, 'failed to read chip')
    } finally {
      this.#busy = false
    }
  }

  async write(payload: NfcPayload): Promise<void> {
    const reader = this.#requireCard()
    this.#busy = true
    try {
      await reader.write(this.#userPage, frame(payload))
    } catch (err) {
      throw new DomainError('NFC_ENCODING_FAILED', `failed to write chip: ${messageOf(err)}`, {
        cause: err,
      })
    } finally {
      this.#busy = false
    }
  }

  async verify(expected: NfcPayload): Promise<boolean> {
    let actual: NfcPayload
    try {
      actual = await this.read()
    } catch {
      return false
    }
    return actual.cardId === expected.cardId && actual.hospitalNo === expected.hospitalNo
  }

  async disconnect(): Promise<void> {
    for (const w of this.#waiters) {
      clearTimeout(w.timer)
      w.reject(new DomainError('HARDWARE_ERROR', 'NFC adapter disconnected'))
    }
    this.#waiters = []
    this.#reader = null
    this.#cardUid = null
    this.#main = null
  }

  #requireCard(): NfcReaderLike {
    if (!this.#reader) throw new DomainError('HARDWARE_ERROR', 'no NFC reader connected')
    if (!this.#cardUid) throw new DomainError('HARDWARE_ERROR', 'no card present at the reader')
    return this.#reader
  }
}

// ── Framing helpers (pure; unit-tested directly) ─────────────────────────────

function ceilToPage(bytes: number): number {
  return Math.ceil(bytes / PAGE_SIZE) * PAGE_SIZE
}

/** Encode a payload as `[len:2][json][zero-pad to page]`. */
export function frame(payload: NfcPayload): Buffer {
  const json = Buffer.from(JSON.stringify({ c: payload.cardId, h: payload.hospitalNo }), 'utf8')
  const total = ceilToPage(HEADER_BYTES + json.length)
  const buf = Buffer.alloc(total)
  buf.writeUInt16BE(json.length, 0)
  json.copy(buf, HEADER_BYTES)
  return buf
}

function decodePayload(json: string): NfcPayload {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new DomainError('HARDWARE_ERROR', 'chip payload is not valid JSON')
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).c !== 'string' ||
    typeof (parsed as Record<string, unknown>).h !== 'string'
  ) {
    throw new DomainError('HARDWARE_ERROR', 'chip payload is missing card_id/hospital_no')
  }
  const rec = parsed as { c: string; h: string }
  return { cardId: CardId(rec.c), hospitalNo: HospitalNo(rec.h) }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function asHardwareError(err: unknown, context: string): DomainError {
  if (err instanceof DomainError) return err
  return new DomainError('HARDWARE_ERROR', `${context}: ${messageOf(err)}`, { cause: err })
}
