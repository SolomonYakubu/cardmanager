import { describe, it, expect } from 'vitest'
import { createCardApp } from './app'
import { InMemoryPatientRepository } from './adapters/memory/patient-repository'
import { InMemoryCardRepository } from './adapters/memory/card-repository'
import { InMemoryCardEventRepository } from './adapters/memory/card-event-repository'
import { FakeNfcAdapter } from './adapters/fake/fake-nfc-adapter'
import { FakePrinterAdapter } from './adapters/fake/fake-printer-adapter'
import { FakeBarcodeScanner } from './adapters/fake/fake-barcode-scanner'
import { HmacOriginalitySigner } from './crypto/originality'
import { FixedClock, SequentialIdGenerator } from './testing/test-doubles'
import { NfcUid } from './domain/ids'

function buildApp() {
  const nfc = new FakeNfcAdapter({ presentUid: NfcUid('demo-chip') })
  const barcode = new FakeBarcodeScanner()
  const app = createCardApp({
    patients: new InMemoryPatientRepository(),
    cards: new InMemoryCardRepository(),
    events: new InMemoryCardEventRepository(),
    nfc,
    printer: new FakePrinterAdapter(),
    barcode,
    originality: new HmacOriginalitySigner('demo-key-at-least-16-bytes-long'),
    clock: new FixedClock(),
    ids: new SequentialIdGenerator(),
  })
  return { app, nfc, barcode }
}

describe('createCardApp', () => {
  it('assembles services that issue and then check in a card end to end', async () => {
    const { app, barcode } = buildApp()
    const patient = await app.patients.register({
      hospitalNo: 'H-1',
      name: 'Jane Doe',
      dateOfBirth: '1990-05-01',
      emrReference: 'EMR-1',
    })

    // Issue.
    const card = await app.issuance.reserve({ patientId: patient.id })
    barcode.setNext(card.originalityCode)
    const issued = await app.issuance.issue(card.id)
    expect(issued.card.status).toBe('ACTIVE')

    // Check in the just-issued card (its data is still on the reader).
    barcode.setNext(card.originalityCode)
    const result = await app.checkIn.checkIn()
    expect(result.ok).toBe(true)
    expect(result.card?.id).toBe(card.id)

    // Lifecycle is wired too.
    const lost = await app.lifecycle.reportLost(card.id)
    expect(lost.status).toBe('LOST')
  })
})
