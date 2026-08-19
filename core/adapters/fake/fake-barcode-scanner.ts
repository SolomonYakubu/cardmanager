import type {
  BarcodeScanner,
  BarcodeScannerState,
  BarcodeScannerStatus,
} from '../../ports/barcode'
import { DomainError } from '../../domain/errors'

export interface FakeBarcodeOptions {
  /** The value the next `scan` will return (null = nothing to scan). */
  nextValue?: string | null
  state?: BarcodeScannerState
}

/** Simulated barcode scanner. `setNext` controls what the next scan decodes. */
export class FakeBarcodeScanner implements BarcodeScanner {
  #state: BarcodeScannerState
  #next: string | null

  constructor(opts: FakeBarcodeOptions = {}) {
    this.#state = opts.state ?? 'OFFLINE'
    this.#next = opts.nextValue ?? null
  }

  /** Test/dev helper: queue the value the scanner will read next. */
  setNext(value: string | null): void {
    this.#next = value
  }

  async connect(): Promise<void> {
    this.#state = 'READY'
  }

  async getStatus(): Promise<BarcodeScannerStatus> {
    return { state: this.#state }
  }

  async scan(): Promise<string> {
    if (this.#next == null) throw new DomainError('HARDWARE_ERROR', 'no barcode presented to scanner')
    return this.#next
  }

  async disconnect(): Promise<void> {
    this.#state = 'OFFLINE'
  }
}
