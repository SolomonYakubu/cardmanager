/**
 * Electron print sinks (real output backends for {@link SystemPrinterAdapter}).
 *
 * Two implementations of the {@link PrintSink} seam:
 *
 *   - {@link ElectronPdfSink}: renders the card to a real PDF under the app's
 *     userData dir via `webContents.printToPDF`. This is the safe default — it
 *     produces a genuine, inspectable card file without consuming card stock,
 *     and works on any machine with zero configuration.
 *
 *   - {@link ElectronPhysicalSink}: sends a silent job to an actual card/badge
 *     printer via `webContents.print`. Selected when a printer device is
 *     configured (CARD_PRINTER). Enumerates real printers for its status.
 *
 * This module imports `electron` at the top level, so it must only ever be
 * imported by the runtime/composition root — never by a unit test. The adapter
 * that uses these sinks ({@link SystemPrinterAdapter}) is import-clean and is
 * what the tests exercise, with a fake sink.
 */

import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { PrinterStatus, PrintJob } from '../../core/ports/printer'
import type { PrintSink } from './system-printer-adapter'

import crypto from 'node:crypto'

/** Load a self-contained HTML document into a hidden window and run `fn`. */
async function withRenderedCard<T>(html: string, fn: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const tempPath = path.join(app.getPath('temp'), `card-render-${crypto.randomUUID()}.html`)
  await fs.writeFile(tempPath, html, 'utf8')

  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 260,
    webPreferences: { offscreen: false, sandbox: false },
  })
  try {
    await win.loadFile(tempPath)
    // Ensure document and images are fully decoded before taking the snapshot/PDF
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const check = () => {
          const imgs = Array.from(document.images);
          if (imgs.every(i => i.complete)) {
            setTimeout(resolve, 60);
          } else {
            setTimeout(check, 30);
          }
        };
        check();
      })
    `)
    return await fn(win)
  } finally {
    win.destroy()
    try {
      await fs.unlink(tempPath)
    } catch {
      // ignore temp file cleanup error
    }
  }
}

/**
 * Writes each card to `userData/cards/<cardRecordId>.pdf`. The returned job id
 * is the absolute PDF path, so the operator (or a test) can open exactly what
 * was produced.
 */
export class ElectronPdfSink implements PrintSink {
  readonly label = 'Card PDF output'
  readonly #dir: string

  /** @param dir Output directory; defaults to `<userData>/cards`. */
  constructor(dir?: string) {
    this.#dir = dir ?? path.join(app.getPath('userData'), 'cards')
  }

  async emit(html: string, job: PrintJob): Promise<string> {
    const pdf = await withRenderedCard(html, (win) =>
      win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    )
    await fs.mkdir(this.#dir, { recursive: true })
    const out = path.join(this.#dir, `${job.cardRecordId}.pdf`)
    await fs.writeFile(out, pdf)
    return out
  }

  async status(): Promise<PrinterStatus> {
    try {
      await fs.mkdir(this.#dir, { recursive: true })
      return { state: 'READY', detail: this.label }
    } catch (err) {
      return { state: 'ERROR', detail: err instanceof Error ? err.message : String(err) }
    }
  }
}

/**
 * Sends a silent print job to a physical printer. If `deviceName` is omitted the
 * OS default printer is used. Keeps one hidden window alive for its lifetime so
 * status polls don't spin up a window each time.
 */
export class ElectronPhysicalSink implements PrintSink {
  readonly label: string
  readonly #deviceName?: string
  #probe: BrowserWindow | null = null

  constructor(deviceName?: string) {
    this.#deviceName = deviceName
    this.label = deviceName ? `Printer: ${deviceName}` : 'Default system printer'
  }

  /** A long-lived hidden window used to enumerate printers for status. */
  #probeWindow(): BrowserWindow {
    if (!this.#probe || this.#probe.isDestroyed()) {
      this.#probe = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    }
    return this.#probe
  }

  async emit(html: string, _job: PrintJob): Promise<string> {
    return withRenderedCard(html, (win) =>
      new Promise<string>((resolve, reject) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: this.#deviceName,
            margins: { marginType: 'none' },
            pageSize: { width: 85725, height: 53975 }, // CR-80 size in microns (3.375" x 2.125")
          },
          (success, failureReason) => {
            if (success) resolve(`printed-${_job.cardRecordId}`)
            else reject(new Error(failureReason || 'print was cancelled or refused'))
          },
        )
      }),
    )
  }

  async status(): Promise<PrinterStatus> {
    try {
      const printers = await this.#probeWindow().webContents.getPrintersAsync()
      if (printers.length === 0) return { state: 'OFFLINE', detail: 'no printers found' }
      if (this.#deviceName) {
        const target = printers.find(
          (p) => p.name === this.#deviceName || p.displayName === this.#deviceName,
        )
        return target
          ? { state: 'READY', detail: target.displayName || target.name }
          : { state: 'OFFLINE', detail: `printer not found: ${this.#deviceName}` }
      }
      return { state: 'READY', detail: `${printers.length} printer(s); OS default` }
    } catch (err) {
      return { state: 'ERROR', detail: err instanceof Error ? err.message : String(err) }
    }
  }
}
