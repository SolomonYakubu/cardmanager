/**
 * Electron runtime (composition root for the running app).
 *
 * Constructs the concrete ports — in-memory repositories, real clock/id/HMAC
 * signer — resolves the hardware (real device or simulated fallback, per
 * device; see {@link resolveHardware}), and assembles the service graph via
 * createCardApp. The services above never learn whether a device is real.
 *
 * {@link DemoStation} stands in for the operator's hands ONLY for simulated
 * devices: presenting a blank chip at the reader, and scanning the freshly
 * printed card. When a device is real it holds no fake to drive, so those calls
 * are no-ops and the operator performs the physical action.
 */

import { createCardApp, type CardApp } from '../core/app'
import { SQLiteDatabase } from '../core/adapters/sqlite/database'
import { SqlitePatientRepository } from '../core/adapters/sqlite/patient-repository'
import { SqliteCardRepository } from '../core/adapters/sqlite/card-repository'
import { SqliteCardEventRepository } from '../core/adapters/sqlite/card-event-repository'
import { SqliteSettingsRepository } from '../core/adapters/sqlite/settings-repository'
import { SqliteDesignRepository } from '../core/adapters/sqlite/design-repository'
import type { FakeNfcAdapter } from '../core/adapters/fake/fake-nfc-adapter'
import type { FakeBarcodeScanner } from '../core/adapters/fake/fake-barcode-scanner'
import { SystemClock } from '../core/adapters/system/system-clock'
import { UuidIdGenerator } from '../core/adapters/system/uuid-id-generator'
import { HmacOriginalitySigner } from '../core/crypto/originality'
import { NfcUid } from '../core/domain/ids'
import type { Card } from '../core/domain/models'
import { resolveHardware, type ResolvedHardware } from './hardware/resolve'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Dev-only fallback key. In a real deployment the issuance key is provided by
 * the environment and kept in an OS keystore (spec open decision #3) — never
 * committed. This fallback only exists so the demo runs out of the box.
 */
const DEV_ORIGINALITY_KEY = 'dev-insecure-originality-key-change-me-please'

export interface Runtime {
  readonly app: CardApp
  readonly sim: DemoStation
  readonly hardware: ResolvedHardware
  readonly settings: SqliteSettingsRepository
  readonly designs: SqliteDesignRepository
}

/**
 * Simulates the physical actions an operator/patient performs at the station,
 * for devices that are running simulated. Each action is applied to the fake
 * behind that device, or skipped when the device is real (the fake is null).
 * The services still perform genuine verify-before-advance against whatever
 * adapter — fake or real — is wired in.
 */
export class DemoStation {
  readonly #nfc: FakeNfcAdapter | null
  readonly #barcode: FakeBarcodeScanner | null

  constructor(nfc: FakeNfcAdapter | null, barcode: FakeBarcodeScanner | null) {
    this.#nfc = nfc
    this.#barcode = barcode
  }

  /** A fresh blank chip sits at the reader, ready to encode (simulated NFC only). */
  presentBlankChip(uid: string): void {
    this.#nfc?.present(NfcUid(uid))
  }

  /** An already-issued card is tapped: its chip holds card_id + hospital_no. */
  async presentCard(card: Card): Promise<void> {
    if (!this.#nfc) return
    this.#nfc.present(card.nfcUid ?? NfcUid(`chip-${card.cardId}`))
    await this.#nfc.write({ cardId: card.cardId, hospitalNo: card.hospitalNo })
  }

  /** The operator scans a barcode (simulated scanner only). */
  primeBarcode(value: string): void {
    this.#barcode?.setNext(value)
  }
}

export async function createRuntime(appDataPath: string): Promise<Runtime> {
  // Reuse the diag logger from main.ts
  const osd = require('node:os')
  const fsd = require('node:fs')
  const DIAG_PATH = path.join(osd.homedir(), 'cardmanage-diag.log')
  const diag = (m: string) => {
    const line = `${new Date().toISOString()} [runtime] ${m}\n`
    try { process.stderr.write(`[DIAG] ${line}`) } catch { /* ignore */ }
    try { fsd.appendFileSync(DIAG_PATH, line) } catch { /* ignore */ }
  }

  diag('createRuntime: start')
  const clock = new SystemClock()
  const ids = new UuidIdGenerator()
  const originality = new HmacOriginalitySigner(
    process.env.CARD_ORIGINALITY_KEY ?? DEV_ORIGINALITY_KEY,
  )

  const dbPath = path.join(appDataPath, 'cardmanage.sqlite')
  
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true })
  }
  
  diag(`createRuntime: opening SQLite at ${dbPath}`)
  const db = new SQLiteDatabase(dbPath)
  diag('createRuntime: SQLite OK')

  const patients = new SqlitePatientRepository(db)
  const cards = new SqliteCardRepository(db)
  const events = new SqliteCardEventRepository(db)
  const settings = new SqliteSettingsRepository(db)

  const designs = new SqliteDesignRepository(db)

  // Resolve real hardware where present, simulated where not. Adapters are
  // already connected by the resolver.
  // Wrap in a timeout: if hardware detection hangs (e.g. PC/SC service not
  // running), fall back to all-simulated after 10 seconds.
  diag('createRuntime: resolving hardware (10s timeout)...')
  let hardware: import('./hardware/resolve').ResolvedHardware
  try {
    hardware = await Promise.race([
      resolveHardware(settings),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Hardware detection timed out after 10s')), 10_000),
      ),
    ])
    diag('createRuntime: hardware resolved OK')
  } catch (err) {
    diag(`createRuntime: hardware detection failed/timed out: ${err instanceof Error ? err.message : String(err)}, using all-simulated`)
    // Fall back to fully simulated hardware
    const fakeNfc = new (await import('../core/adapters/fake/fake-nfc-adapter')).FakeNfcAdapter({ presentUid: NfcUid('demo-chip-0001') })
    await fakeNfc.connect()
    const fakePrinter = new (await import('../core/adapters/fake/fake-printer-adapter')).FakePrinterAdapter()
    await fakePrinter.connect()
    const fakeBarcode = new (await import('../core/adapters/fake/fake-barcode-scanner')).FakeBarcodeScanner()
    await fakeBarcode.connect()
    hardware = {
      nfc: { adapter: fakeNfc, mode: 'simulated', kind: 'Simulated NFC', detail: 'timeout fallback' },
      printer: { adapter: fakePrinter, mode: 'simulated', kind: 'Simulated printer', detail: 'timeout fallback' },
      barcode: { adapter: fakeBarcode, mode: 'simulated', kind: 'Simulated scanner', detail: 'timeout fallback' },
      fakes: { nfc: fakeNfc, barcode: fakeBarcode },
    }
  }

  const app = createCardApp({
    patients,
    cards,
    events,
    nfc: hardware.nfc.adapter,
    printer: hardware.printer.adapter,
    barcode: hardware.barcode.adapter,
    originality,
    clock,
    ids,
  })

  diag('createRuntime: done')
  return {
    app,
    sim: new DemoStation(hardware.fakes.nfc, hardware.fakes.barcode),
    hardware,
    settings,
    designs,
  }
}
