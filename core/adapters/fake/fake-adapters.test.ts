import { describe, it, expect } from 'vitest'
import { FakeNfcAdapter } from './fake-nfc-adapter'
import { FakePrinterAdapter } from './fake-printer-adapter'
import { FakeBarcodeScanner } from './fake-barcode-scanner'
import { CardId, CardRecordId, HospitalNo, NfcUid, OriginalityCode } from '../../domain/ids'
import { DomainError } from '../../domain/errors'
import type { NfcPayload } from '../../ports/nfc'
import type { PrintJob } from '../../ports/printer'

const payload: NfcPayload = { cardId: CardId('card-1'), hospitalNo: HospitalNo('H-1') }

describe('FakeNfcAdapter', () => {
  it('reports status and returns the present chip UID', async () => {
    const nfc = new FakeNfcAdapter({ presentUid: NfcUid('04:aa') })
    await nfc.connect()
    expect((await nfc.getStatus()).state).toBe('READY')
    expect(await nfc.waitForCard()).toBe('04:aa')
  })

  it('throws when no chip is present', async () => {
    await expect(new FakeNfcAdapter().waitForCard()).rejects.toThrow(DomainError)
  })

  it('writes then reads back the payload and verifies it', async () => {
    const nfc = new FakeNfcAdapter({ presentUid: NfcUid('04:aa') })
    await nfc.write(payload)
    expect(await nfc.read()).toEqual(payload)
    expect(await nfc.verify(payload)).toBe(true)
  })

  it('fails the write when configured (encode failure)', async () => {
    const nfc = new FakeNfcAdapter({ failWrite: true })
    await expect(nfc.write(payload)).rejects.toMatchObject({ code: 'NFC_ENCODING_FAILED' })
  })

  it('lets verify catch a corrupt write', async () => {
    const nfc = new FakeNfcAdapter({ corruptWrite: true })
    await nfc.write(payload)
    expect(await nfc.verify(payload)).toBe(false)
  })
})

describe('FakePrinterAdapter', () => {
  const job: PrintJob = {
    cardRecordId: CardRecordId('c1'),
    artwork: {
      patientName: 'Jane Doe',
      hospitalNo: HospitalNo('H-1'),
      emrLink: 'https://emr/EMR-1',
      barcodeValue: OriginalityCode('oc-1'),
    },
  }

  it('accepts and captures a print job', async () => {
    const printer = new FakePrinterAdapter()
    await printer.connect()
    const result = await printer.print(job)
    expect(result.accepted).toBe(true)
    expect(printer.jobs).toHaveLength(1)
  })

  it('throws on a hard failure', async () => {
    const printer = new FakePrinterAdapter({ failPrint: true })
    await expect(printer.print(job)).rejects.toMatchObject({ code: 'PRINT_FAILED' })
  })

  it('can refuse a job without throwing', async () => {
    const printer = new FakePrinterAdapter({ rejectPrint: true })
    expect((await printer.print(job)).accepted).toBe(false)
    expect(printer.jobs).toHaveLength(0)
  })
})

describe('FakeBarcodeScanner', () => {
  it('returns the queued value', async () => {
    const scanner = new FakeBarcodeScanner({ nextValue: 'oc-1' })
    expect(await scanner.scan()).toBe('oc-1')
  })

  it('throws when nothing is presented', async () => {
    await expect(new FakeBarcodeScanner().scan()).rejects.toThrow(DomainError)
  })

  it('setNext queues the next read', async () => {
    const scanner = new FakeBarcodeScanner()
    scanner.setNext('oc-2')
    expect(await scanner.scan()).toBe('oc-2')
  })
})
