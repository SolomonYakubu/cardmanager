/**
 * Printer port (spec §4 — printer side, vendor-agnostic).
 *
 * The services layer talks only to this interface. A driver-level implementation
 * (default) or a vendor SDK implementation (Evolis/Zebra, added later) can be
 * swapped in with zero changes above this line. Status is deliberately
 * vendor-neutral (spec §5): ready / busy / error / offline.
 */

import type { CardRecordId, HospitalNo, OriginalityCode } from '../domain/ids'

export type PrinterState = 'READY' | 'BUSY' | 'ERROR' | 'OFFLINE'

export interface PrinterStatus {
  readonly state: PrinterState
  /** Operator-facing detail (e.g. "check ribbon"), never a raw SDK code (spec §10). */
  readonly detail?: string
}

/**
 * Vendor-neutral rendered-card payload (spec §7 render step). A driver-level
 * adapter rasterizes this to a print job; an SDK adapter maps it to vendor calls.
 */
export interface CardArtwork {
  readonly patientName: string
  readonly hospitalNo: HospitalNo
  /** EMR deep link encoded into the QR channel. */
  readonly emrLink: string
  /** Value encoded into the barcode channel. */
  readonly barcodeValue: OriginalityCode
  readonly frontBackground?: string
  readonly backBackground?: string
  readonly walletNo?: string
}

export interface PrintJob {
  readonly cardRecordId: CardRecordId
  readonly artwork: CardArtwork
}

export interface PrintResult {
  readonly jobId: string
  readonly accepted: boolean
}

export interface PrinterAdapter {
  connect(): Promise<void>
  getStatus(): Promise<PrinterStatus>
  print(job: PrintJob): Promise<PrintResult>
  cancel(jobId: string): Promise<void>
  disconnect(): Promise<void>
}
