/**
 * Hardware resolution (composition-time device selection).
 *
 * Decides, per device, whether to drive real hardware or fall back to a
 * simulated adapter — so the app runs on a bare laptop AND uses attached
 * hardware when present, without a code change. The hardware strip in the UI
 * reflects the honest result (real state vs. "Simulated").
 *
 * This module is the ONLY place the native/heavy SDKs are loaded, via dynamic
 * import so a missing or ABI-mismatched module degrades to simulation instead
 * of crashing the app. It is imported solely by the runtime (main process);
 * tests never import it, so they never touch a native module.
 *
 * Configuration (environment variables):
 *   CARD_HW        auto (default) | fake | real
 *                  - fake: everything simulated
 *                  - auto: use a device if actually detected, else simulate
 *                  - real: force real adapters (still falls back if a module
 *                          truly can't load, so the app always starts)
 *   CARD_PRINTER   pdf (default) | physical | physical:<device name>
 *   CARD_BARCODE   (unset = simulated) | serial:<path>[:baud] | keyboard
 */

import type { NfcAdapter } from '../../core/ports/nfc'
import type { PrinterAdapter } from '../../core/ports/printer'
import type { BarcodeScanner } from '../../core/ports/barcode'
import { NfcUid } from '../../core/domain/ids'
import { FakeNfcAdapter } from '../../core/adapters/fake/fake-nfc-adapter'
import { FakePrinterAdapter } from '../../core/adapters/fake/fake-printer-adapter'
import { FakeBarcodeScanner } from '../../core/adapters/fake/fake-barcode-scanner'
import { PcscNfcAdapter, type NfcLib } from '../adapters/pcsc-nfc-adapter'
import { SystemPrinterAdapter } from '../adapters/system-printer-adapter'
import { ElectronPdfSink, ElectronPhysicalSink } from '../adapters/electron-print-sink'
import {
  SerialBarcodeScanner,
  type SerialPortCtor,
  type ReadlineParserCtor,
} from '../adapters/serial-barcode-scanner'

export type DeviceMode = 'real' | 'simulated'

export interface ResolvedDevice<T> {
  readonly adapter: T
  readonly mode: DeviceMode
  /** Short human label for logs/diagnostics, e.g. "PC/SC reader". */
  readonly kind: string
  readonly detail?: string
}

export interface ResolvedHardware {
  readonly nfc: ResolvedDevice<NfcAdapter>
  readonly printer: ResolvedDevice<PrinterAdapter>
  readonly barcode: ResolvedDevice<BarcodeScanner>
  /**
   * The fake instances, when a device is simulated, so the DemoStation can
   * drive them (present a chip, prime a scan). Null when the device is real —
   * the operator performs the physical action instead.
   */
  readonly fakes: {
    readonly nfc: FakeNfcAdapter | null
    readonly barcode: FakeBarcodeScanner | null
  }
}

type HwMode = 'auto' | 'fake' | 'real'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function loadNfcLib(): Promise<NfcLib | null> {
  // The pcsclite native addon calls SCardEstablishContext synchronously,
  // which BLOCKS the event loop indefinitely if the Windows Smart Card
  // service (SCardSvr) is not running. Check the service first.
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process')
      const output = execSync('sc query SCardSvr', { encoding: 'utf-8', timeout: 3000 })
      if (!output.includes('RUNNING')) {
        console.log('[cardmanage] Smart Card service not running — skipping NFC')
        return null
      }
    } catch {
      console.log('[cardmanage] Could not query Smart Card service — skipping NFC')
      return null
    }
  }
  try {
    const mod = await import('nfc-pcsc')
    return mod.NFC as unknown as NfcLib
  } catch {
    return null
  }
}

async function loadSerialLib(): Promise<{
  SerialPort: SerialPortCtor
  ReadlineParser: ReadlineParserCtor
} | null> {
  try {
    const mod = await import('serialport')
    return {
      SerialPort: mod.SerialPort as unknown as SerialPortCtor,
      ReadlineParser: mod.ReadlineParser as unknown as ReadlineParserCtor,
    }
  } catch {
    return null
  }
}

/** Poll until a reader is connected (state READY/BUSY) or the deadline passes. */
async function waitForReader(adapter: PcscNfcAdapter, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms
  for (;;) {
    const { state } = await adapter.getStatus()
    if (state === 'READY' || state === 'BUSY') return true
    if (Date.now() >= deadline) return false
    await sleep(150)
  }
}

async function resolveNfc(mode: HwMode): Promise<ResolvedDevice<NfcAdapter>> {
  if (mode === 'fake') {
    return { adapter: new FakeNfcAdapter({ presentUid: NfcUid('demo-chip-0001') }), mode: 'simulated', kind: 'Simulated NFC' }
  }
  const NFC = await loadNfcLib()
  if (!NFC) {
    return {
      adapter: new FakeNfcAdapter({ presentUid: NfcUid('demo-chip-0001') }),
      mode: 'simulated',
      kind: 'Simulated NFC',
      detail: 'PC/SC module unavailable',
    }
  }
  const real = new PcscNfcAdapter({ NFC })
  await real.connect()
  // In auto mode, only commit to real hardware if a reader is actually there.
  if (mode === 'auto') {
    const present = await waitForReader(real, 2_000)
    if (!present) {
      await real.disconnect()
      return {
        adapter: new FakeNfcAdapter({ presentUid: NfcUid('demo-chip-0001') }),
        mode: 'simulated',
        kind: 'Simulated NFC',
        detail: 'no PC/SC reader detected',
      }
    }
  }
  const status = await real.getStatus()
  return { adapter: real, mode: 'real', kind: 'PC/SC reader', detail: status.detail }
}

async function resolvePrinter(mode: HwMode, settings?: import('../../core/adapters/sqlite/settings-repository').SqliteSettingsRepository): Promise<ResolvedDevice<PrinterAdapter>> {
  if (mode === 'fake') {
    const fake = new FakePrinterAdapter()
    await fake.connect()
    return { adapter: fake, mode: 'simulated', kind: 'Simulated printer' }
  }
  
  let cfg = settings ? await settings.get('printer_mode') : undefined
  if (!cfg) cfg = process.env.CARD_PRINTER?.trim() ?? 'pdf'
  
  if (cfg === 'physical' || cfg.startsWith('physical:')) {
    const deviceName = cfg.startsWith('physical:') ? cfg.slice('physical:'.length) : undefined
    const adapter = new SystemPrinterAdapter(new ElectronPhysicalSink(deviceName || undefined))
    await adapter.connect()
    return { adapter, mode: 'real', kind: 'Physical printer', detail: deviceName }
  }
  // Default: a real, inspectable PDF card. Works everywhere, wastes no stock.
  const adapter = new SystemPrinterAdapter(new ElectronPdfSink())
  await adapter.connect()
  return { adapter, mode: 'real', kind: 'PDF card output' }
}

async function resolveBarcode(mode: HwMode): Promise<{
  device: ResolvedDevice<BarcodeScanner>
  fake: FakeBarcodeScanner | null
}> {
  const simulated = async (detail?: string) => {
    const fake = new FakeBarcodeScanner()
    await fake.connect()
    return { device: { adapter: fake, mode: 'simulated' as const, kind: 'Simulated scanner', detail }, fake }
  }

  if (mode === 'fake') return simulated()

  const cfg = process.env.CARD_BARCODE?.trim()
  if (cfg && cfg.startsWith('serial:')) {
    const [, path, baud] = cfg.split(':')
    const lib = await loadSerialLib()
    if (!lib || !path) {
      return simulated(lib ? 'invalid CARD_BARCODE path' : 'serialport module unavailable')
    }
    try {
      const scanner = new SerialBarcodeScanner({
        SerialPort: lib.SerialPort,
        ReadlineParser: lib.ReadlineParser,
        path,
        baudRate: baud ? Number(baud) : undefined,
      })
      await scanner.connect()
      return { device: { adapter: scanner, mode: 'real', kind: 'Serial scanner', detail: path }, fake: null }
    } catch (err) {
      return simulated(err instanceof Error ? err.message : String(err))
    }
  }

  // No serial scanner configured. Keyboard-wedge scanners feed the renderer
  // directly; the issuance scan step is simulated against the printed code.
  return simulated(cfg === 'keyboard' ? 'keyboard-wedge (handled in UI)' : undefined)
}

export async function resolveHardware(settings?: import('../../core/adapters/sqlite/settings-repository').SqliteSettingsRepository): Promise<ResolvedHardware> {
  const mode = (process.env.CARD_HW?.trim() as HwMode) || 'auto'

  const [nfc, printer, barcode] = await Promise.all([
    resolveNfc(mode),
    resolvePrinter(mode, settings),
    resolveBarcode(mode),
  ])

  // Bring simulated NFC online (real NFC connected during detection).
  const nfcFake = nfc.mode === 'simulated' ? (nfc.adapter as FakeNfcAdapter) : null
  if (nfcFake) await nfcFake.connect()

  return {
    nfc,
    printer,
    barcode: barcode.device,
    fakes: { nfc: nfcFake, barcode: barcode.fake },
  }
}
