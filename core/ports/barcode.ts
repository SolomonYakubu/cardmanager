/**
 * Barcode scanner port (spec §7 print-verify, §8 authenticity spot-check).
 *
 * At issuance the operator scans the freshly printed barcode so the system can
 * recompute the originality code before trusting the print. At check-in the
 * same channel provides an anti-forgery spot check. The scanned value is the
 * raw decoded string; the service is responsible for verifying it.
 */

export type BarcodeScannerState = 'READY' | 'BUSY' | 'ERROR' | 'OFFLINE'

export interface BarcodeScannerStatus {
  readonly state: BarcodeScannerState
  readonly detail?: string
}

export interface BarcodeScanner {
  connect(): Promise<void>
  getStatus(): Promise<BarcodeScannerStatus>
  /** Block until a barcode is scanned; resolves with the decoded value. */
  scan(options?: { timeoutMs?: number }): Promise<string>
  disconnect(): Promise<void>
}
