/**
 * Serial barcode scanner adapter (real).
 *
 * Implements the {@link BarcodeScanner} port for RS-232 / USB-CDC ("virtual COM
 * port") barcode readers via the `serialport` package. Each scan the device
 * emits arrives as a delimited line; `scan()` resolves with the next one.
 *
 * `serialport` uses a stable N-API binding, so unlike the NFC stack it *does*
 * load under plain Node. Even so, we inject the SDK constructors rather than
 * importing them here: opening a real port isn't something a unit test should
 * do, and injection lets tests drive the adapter with a fake port + parser.
 *
 * Not every scanner is serial — many are USB HID "keyboard-wedge" devices that
 * type the barcode into the focused field. That path is handled in the renderer
 * (a focused capture input) and needs no adapter; this adapter covers the
 * serial/VCP family. The runtime selects it when CARD_BARCODE=serial:<path>.
 */

import type {
  BarcodeScanner,
  BarcodeScannerState,
  BarcodeScannerStatus,
} from '../../core/ports/barcode'
import { DomainError } from '../../core/domain/errors'

// ── Structural types for the slice of `serialport` we use ────────────────────
// Kept minimal and local so the adapter isn't coupled to serialport's concrete
// types; the runtime casts the real constructors to these when injecting.

export interface SerialPortLike {
  readonly isOpen: boolean
  on(event: 'open', listener: () => void): void
  on(event: 'error', listener: (err: Error) => void): void
  on(event: 'close', listener: () => void): void
  pipe(destination: ParserLike): ParserLike
  close(callback?: (err?: Error | null) => void): void
}

export interface ParserLike {
  on(event: 'data', listener: (line: string | Buffer) => void): void
}

export interface SerialPortCtor {
  new (options: { path: string; baudRate: number; autoOpen?: boolean }): SerialPortLike
}

export interface ReadlineParserCtor {
  new (options?: { delimiter?: string }): ParserLike
}

export interface SerialBarcodeOptions {
  readonly SerialPort: SerialPortCtor
  readonly ReadlineParser: ReadlineParserCtor
  /** Serial device path, e.g. /dev/tty.usbserial-XXX or COM3. */
  readonly path: string
  readonly baudRate?: number
  /** Line delimiter the scanner appends after each code. */
  readonly delimiter?: string
  /** Default time `scan()` waits for a code before giving up. */
  readonly scanTimeoutMs?: number
}

interface Waiter {
  resolve: (value: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class SerialBarcodeScanner implements BarcodeScanner {
  readonly #SerialPort: SerialPortCtor
  readonly #ReadlineParser: ReadlineParserCtor
  readonly #path: string
  readonly #baudRate: number
  readonly #delimiter: string
  readonly #scanTimeoutMs: number

  #port: SerialPortLike | null = null
  #state: BarcodeScannerState = 'OFFLINE'
  #lastError: string | undefined
  /** Codes decoded but not yet consumed by a scan() call. */
  #queue: string[] = []
  #waiters: Waiter[] = []

  constructor(opts: SerialBarcodeOptions) {
    this.#SerialPort = opts.SerialPort
    this.#ReadlineParser = opts.ReadlineParser
    this.#path = opts.path
    this.#baudRate = opts.baudRate ?? 9600
    this.#delimiter = opts.delimiter ?? '\r\n'
    this.#scanTimeoutMs = opts.scanTimeoutMs ?? 30_000
  }

  async connect(): Promise<void> {
    if (this.#port) return
    await new Promise<void>((resolve, reject) => {
      const port = new this.#SerialPort({ path: this.#path, baudRate: this.#baudRate, autoOpen: true })
      let settled = false
      port.on('open', () => {
        this.#state = 'READY'
        this.#lastError = undefined
        if (!settled) {
          settled = true
          resolve()
        }
      })
      port.on('error', (err) => {
        this.#state = 'ERROR'
        this.#lastError = err.message
        if (!settled) {
          settled = true
          reject(new DomainError('HARDWARE_ERROR', `could not open scanner port: ${err.message}`))
        } else {
          this.#failWaiters(err.message)
        }
      })
      port.on('close', () => {
        this.#state = 'OFFLINE'
      })
      const parser = port.pipe(new this.#ReadlineParser({ delimiter: this.#delimiter }))
      parser.on('data', (line) => this.#onLine(line))
      this.#port = port
    })
  }

  #onLine(line: string | Buffer): void {
    const code = (typeof line === 'string' ? line : line.toString('utf8')).trim()
    if (!code) return
    const waiter = this.#waiters.shift()
    if (waiter) {
      clearTimeout(waiter.timer)
      waiter.resolve(code)
    } else {
      this.#queue.push(code)
    }
  }

  #failWaiters(message: string): void {
    const waiters = this.#waiters
    this.#waiters = []
    for (const w of waiters) {
      clearTimeout(w.timer)
      w.reject(new DomainError('HARDWARE_ERROR', message))
    }
  }

  async getStatus(): Promise<BarcodeScannerStatus> {
    if (this.#lastError && this.#state === 'ERROR') {
      return { state: 'ERROR', detail: this.#lastError }
    }
    return { state: this.#state, detail: this.#state === 'READY' ? this.#path : undefined }
  }

  async scan(options?: { timeoutMs?: number }): Promise<string> {
    const queued = this.#queue.shift()
    if (queued !== undefined) return queued
    if (!this.#port || this.#state === 'OFFLINE') {
      throw new DomainError('HARDWARE_ERROR', 'scanner is not connected')
    }
    const timeoutMs = options?.timeoutMs ?? this.#scanTimeoutMs
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiters = this.#waiters.filter((w) => w.timer !== timer)
        reject(new DomainError('HARDWARE_ERROR', 'timed out waiting for a barcode scan'))
      }, timeoutMs)
      this.#waiters.push({ resolve, reject, timer })
    })
  }

  async disconnect(): Promise<void> {
    this.#failWaiters('scanner disconnected')
    this.#queue = []
    const port = this.#port
    this.#port = null
    this.#state = 'OFFLINE'
    if (port && port.isOpen) {
      await new Promise<void>((resolve) => port.close(() => resolve()))
    }
  }
}
