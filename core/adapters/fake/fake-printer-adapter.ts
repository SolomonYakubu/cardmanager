import type {
  PrinterAdapter,
  PrinterState,
  PrinterStatus,
  PrintJob,
  PrintResult,
} from '../../ports/printer'
import { DomainError } from '../../domain/errors'

export interface FakePrinterOptions {
  /** Make `print` throw, simulating a hard printer error (spec §10). */
  failPrint?: boolean
  /** Let `print` return `accepted: false` (job refused, no throw). */
  rejectPrint?: boolean
  state?: PrinterState
}

/**
 * Simulated driver-level card printer. Captures accepted jobs in `jobs` so
 * tests can assert what artwork was sent. Failure flags are public/mutable to
 * support retry scenarios.
 */
export class FakePrinterAdapter implements PrinterAdapter {
  #state: PrinterState
  #seq = 0
  failPrint: boolean
  rejectPrint: boolean
  readonly jobs: PrintJob[] = []

  constructor(opts: FakePrinterOptions = {}) {
    this.#state = opts.state ?? 'OFFLINE'
    this.failPrint = opts.failPrint ?? false
    this.rejectPrint = opts.rejectPrint ?? false
  }

  async connect(): Promise<void> {
    this.#state = 'READY'
  }

  async getStatus(): Promise<PrinterStatus> {
    return { state: this.#state }
  }

  async print(job: PrintJob): Promise<PrintResult> {
    if (this.failPrint) {
      throw new DomainError('PRINT_FAILED', 'simulated printer error — check ribbon/card stock')
    }
    const accepted = !this.rejectPrint
    if (accepted) this.jobs.push(job)
    return { jobId: `job-${++this.#seq}`, accepted }
  }

  async cancel(): Promise<void> {
    // no-op for the fake
  }

  async disconnect(): Promise<void> {
    this.#state = 'OFFLINE'
  }
}
