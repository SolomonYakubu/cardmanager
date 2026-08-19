import { describe, it, expect } from 'vitest'
import { SystemPrinterAdapter, type PrintSink } from './system-printer-adapter'
import { CardRecordId, HospitalNo, OriginalityCode } from '../../core/domain/ids'
import type { CardArtwork, PrinterStatus, PrintJob } from '../../core/ports/printer'

/**
 * A fake {@link PrintSink} standing in for Electron's PDF/physical backends, so
 * the adapter's own logic (connect gating, render → emit, error mapping) can be
 * exercised in plain Node without a window or a printer.
 */
class FakePrintSink implements PrintSink {
  readonly label = 'Fake sink'
  readonly emitted: { html: string; job: PrintJob }[] = []
  jobId = 'job-1'
  emitError: Error | null = null
  statusValue: PrinterStatus = { state: 'READY', detail: 'fake ready' }
  statusError: Error | null = null

  async emit(html: string, job: PrintJob): Promise<string> {
    if (this.emitError) throw this.emitError
    this.emitted.push({ html, job })
    return this.jobId
  }

  async status(): Promise<PrinterStatus> {
    if (this.statusError) throw this.statusError
    return this.statusValue
  }
}

const artwork: CardArtwork = {
  patientName: 'Jane Doe',
  hospitalNo: HospitalNo('H-000123'),
  emrLink: 'https://emr.example/patient/EMR-1',
  barcodeValue: OriginalityCode('OC-ABC-123'),
}
const job: PrintJob = { cardRecordId: CardRecordId('rec-1'), artwork }

describe('SystemPrinterAdapter', () => {
  it('is OFFLINE until connected, and OFFLINE again after disconnect', async () => {
    const sink = new FakePrintSink()
    const printer = new SystemPrinterAdapter(sink)
    expect((await printer.getStatus()).state).toBe('OFFLINE')
    await printer.connect()
    expect((await printer.getStatus()).state).toBe('READY')
    await printer.disconnect()
    expect((await printer.getStatus()).state).toBe('OFFLINE')
  })

  it('delegates status to the sink once connected', async () => {
    const sink = new FakePrintSink()
    sink.statusValue = { state: 'READY', detail: 'Card PDF output' }
    const printer = new SystemPrinterAdapter(sink)
    await printer.connect()
    expect(await printer.getStatus()).toEqual({ state: 'READY', detail: 'Card PDF output' })
  })

  it('maps a sink status failure to ERROR', async () => {
    const sink = new FakePrintSink()
    sink.statusError = new Error('spooler unreachable')
    const printer = new SystemPrinterAdapter(sink)
    await printer.connect()
    expect(await printer.getStatus()).toEqual({ state: 'ERROR', detail: 'spooler unreachable' })
  })

  it('renders the card and hands real HTML to the sink', async () => {
    const sink = new FakePrintSink()
    const printer = new SystemPrinterAdapter(sink)
    await printer.connect()

    const result = await printer.print(job)

    expect(result).toEqual({ jobId: 'job-1', accepted: true })
    expect(sink.emitted).toHaveLength(1)
    const { html, job: seen } = sink.emitted[0]
    expect(seen).toBe(job)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('data:image/png;base64,') // the barcode/QR really rendered
  })

  it('refuses to print while offline (PRINT_FAILED)', async () => {
    const printer = new SystemPrinterAdapter(new FakePrintSink())
    await expect(printer.print(job)).rejects.toMatchObject({
      code: 'PRINT_FAILED',
      message: 'printer is offline',
    })
  })

  it('maps a sink emit failure to PRINT_FAILED (and preserves the cause)', async () => {
    const sink = new FakePrintSink()
    sink.emitError = new Error('out of card stock')
    const printer = new SystemPrinterAdapter(sink)
    await printer.connect()
    await expect(printer.print(job)).rejects.toMatchObject({
      code: 'PRINT_FAILED',
      cause: sink.emitError,
    })
  })

  it('maps an artwork render failure to PRINT_FAILED', async () => {
    const sink = new FakePrintSink()
    const printer = new SystemPrinterAdapter(sink)
    await printer.connect()
    // An empty barcode value makes bwip-js reject; the smart constructor would
    // normally forbid it, so cast past it to drive the render-failure branch.
    const bad: PrintJob = {
      cardRecordId: CardRecordId('rec-2'),
      artwork: { ...artwork, barcodeValue: '' as unknown as OriginalityCode },
    }
    await expect(printer.print(bad)).rejects.toMatchObject({ code: 'PRINT_FAILED' })
    expect(sink.emitted).toHaveLength(0) // never reached the sink
  })

  it('cancel is a harmless no-op', async () => {
    const printer = new SystemPrinterAdapter(new FakePrintSink())
    await printer.connect()
    await expect(printer.cancel()).resolves.toBeUndefined()
  })
})
