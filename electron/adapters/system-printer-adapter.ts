/**
 * System printer adapter (real, driver-level).
 *
 * Implements the {@link PrinterAdapter} port by rendering the card to HTML
 * ({@link renderCardHtml}) and handing it to an injected {@link PrintSink} — the
 * thing that actually turns HTML into output. The sink is a seam:
 *
 *   - {@link ElectronPdfSink}      → writes a real card PDF (demo-safe default)
 *   - {@link ElectronPhysicalSink} → sends a silent job to a physical printer
 *   - a fake sink                  → lets tests exercise this adapter in Node
 *
 * Keeping the Electron-dependent sinks in a separate module means this file
 * imports nothing native, so it (and its tests) load under Vitest. The sinks
 * live in ./electron-print-sink.ts and are only ever imported by the runtime.
 */

import type {
  PrinterAdapter,
  PrinterStatus,
  PrintJob,
  PrintResult,
} from '../../core/ports/printer'
import { DomainError } from '../../core/domain/errors'
import { renderCardHtml } from './artwork'

/**
 * The rendering backend behind the printer. Given a print-ready HTML document
 * and its job, produce output and return a stable job id (a PDF path, a printer
 * job tag). Throwing signals a hard failure the adapter maps to PRINT_FAILED.
 */
export interface PrintSink {
  /** Human-facing label for the status line (e.g. "Card PDF output"). */
  readonly label: string
  emit(html: string, job: PrintJob): Promise<string>
  /** Current backend health, vendor-neutral. */
  status(): Promise<PrinterStatus>
}

function detail(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export class SystemPrinterAdapter implements PrinterAdapter {
  #sink: PrintSink
  #connected = false

  constructor(sink: PrintSink) {
    this.#sink = sink
  }

  setSink(sink: PrintSink) {
    this.#sink = sink
  }

  async connect(): Promise<void> {
    this.#connected = true
  }

  async getStatus(): Promise<PrinterStatus> {
    if (!this.#connected) return { state: 'OFFLINE' }
    try {
      return await this.#sink.status()
    } catch (err) {
      return { state: 'ERROR', detail: detail(err) }
    }
  }

  async print(job: PrintJob): Promise<PrintResult> {
    if (!this.#connected) {
      throw new DomainError('PRINT_FAILED', 'printer is offline')
    }
    let html: string
    try {
      html = await renderCardHtml(job.artwork)
    } catch (err) {
      throw new DomainError('PRINT_FAILED', `could not render card artwork: ${detail(err)}`, {
        cause: err,
      })
    }
    try {
      const jobId = await this.#sink.emit(html, job)
      return { jobId, accepted: true }
    } catch (err) {
      throw new DomainError('PRINT_FAILED', `print job failed: ${detail(err)}`, { cause: err })
    }
  }

  async cancel(): Promise<void> {
    // Driver-level jobs complete synchronously from our side; nothing to cancel.
  }

  async disconnect(): Promise<void> {
    this.#connected = false
  }
}
