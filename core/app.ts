/**
 * Composition root (application assembly).
 *
 * Wires the concrete ports (repositories, hardware adapters, signer, clock, id
 * generator) into the service graph. This is the ONE place that knows how the
 * pieces fit together; everything else depends only on interfaces.
 *
 * It is deliberately framework-free and adapter-agnostic: pass in in-memory +
 * fake implementations for the MVP and tests, or SQLite + real-device adapters
 * later, with no change to the services themselves.
 */

import type { PatientRepository, CardRepository, CardEventRepository } from './ports/repositories'
import type { NfcAdapter } from './ports/nfc'
import type { PrinterAdapter } from './ports/printer'
import type { BarcodeScanner } from './ports/barcode'
import type { OriginalitySigner } from './crypto/originality'
import type { Clock, IdGenerator } from './ports/system'
import { AuditLog } from './services/audit-log'
import { PatientService } from './services/patient-service'
import { IssuanceService } from './services/issuance-service'
import { CheckInService } from './services/check-in-service'
import { CardLifecycleService } from './services/lifecycle-service'

export interface CardAppPorts {
  readonly patients: PatientRepository
  readonly cards: CardRepository
  readonly events: CardEventRepository
  readonly nfc: NfcAdapter
  readonly printer: PrinterAdapter
  readonly barcode: BarcodeScanner
  readonly originality: OriginalitySigner
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly emrLinkBase?: string
}

export interface CardApp {
  /** Patient registration + lookup use cases. */
  readonly patients: PatientService
  readonly cards: CardRepository
  readonly audit: AuditLog
  readonly issuance: IssuanceService
  readonly checkIn: CheckInService
  readonly lifecycle: CardLifecycleService
}

export function createCardApp(ports: CardAppPorts): CardApp {
  const audit = new AuditLog(ports.events, ports.clock, ports.ids)
  const patients = new PatientService(ports.patients, ports.clock, ports.ids)

  const issuance = new IssuanceService({
    cards: ports.cards,
    patients: ports.patients,
    audit,
    nfc: ports.nfc,
    printer: ports.printer,
    barcode: ports.barcode,
    originality: ports.originality,
    clock: ports.clock,
    ids: ports.ids,
    emrLinkBase: ports.emrLinkBase,
  })

  const checkIn = new CheckInService({
    cards: ports.cards,
    patients: ports.patients,
    audit,
    nfc: ports.nfc,
    barcode: ports.barcode,
    originality: ports.originality,
    emrLinkBase: ports.emrLinkBase,
  })

  const lifecycle = new CardLifecycleService({
    cards: ports.cards,
    audit,
    clock: ports.clock,
    issuance,
  })

  return { patients, cards: ports.cards, audit, issuance, checkIn, lifecycle }
}
