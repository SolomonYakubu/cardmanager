import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { PcscNfcAdapter, frame, type NfcLib } from './pcsc-nfc-adapter'
import { CardId, HospitalNo } from '../../core/domain/ids'
import type { NfcPayload } from '../../core/ports/nfc'

const PAGE = 4

/**
 * A fake nfc-pcsc reader: an EventEmitter (for `card`/`card.off`/`error`/`end`)
 * backed by a flat page memory. `read`/`write` use `block * PAGE` byte offsets,
 * matching how the adapter addresses NTAG user pages — so a write followed by a
 * read round-trips through the same bytes a real tag would hold.
 */
class FakeReader extends EventEmitter {
  readonly reader = { name: 'ACME PC/SC Reader 01' }
  readonly mem = Buffer.alloc(512)
  failWrite = false

  async read(block: number, length: number): Promise<Buffer> {
    return Buffer.from(this.mem.subarray(block * PAGE, block * PAGE + length))
  }

  async write(block: number, data: Buffer): Promise<void> {
    if (this.failWrite) throw new Error('tag write NAK')
    data.copy(this.mem, block * PAGE)
  }

  presentCard(uid: string): void {
    this.emit('card', { uid })
  }

  removeCard(): void {
    this.emit('card.off', {})
  }
}

class FakeMain extends EventEmitter {}

/** Build the adapter with an injected fake NFC lib; returns the seams to drive. */
function setup(waitTimeoutMs = 100) {
  const main = new FakeMain()
  // A constructor that returns our pre-built main, so the test controls it.
  const NFC = function (this: unknown) {
    return main
  } as unknown as NfcLib
  const adapter = new PcscNfcAdapter({ NFC, waitTimeoutMs })
  const attachReader = (): FakeReader => {
    const reader = new FakeReader()
    main.emit('reader', reader)
    return reader
  }
  return { adapter, main, attachReader }
}

const payload: NfcPayload = { cardId: CardId('card-xyz'), hospitalNo: HospitalNo('H-000123') }

describe('frame (on-tag encoding)', () => {
  it('is page-aligned with a big-endian length prefix and JSON body', () => {
    const buf = frame(payload)
    expect(buf.length % PAGE).toBe(0)
    const len = buf.readUInt16BE(0)
    const json = buf.subarray(2, 2 + len).toString('utf8')
    expect(JSON.parse(json)).toEqual({ c: 'card-xyz', h: 'H-000123' })
  })
})

describe('PcscNfcAdapter', () => {
  it('is OFFLINE before connect, and reports "no reader" after connect with none attached', async () => {
    const { adapter } = setup()
    expect(await adapter.getStatus()).toEqual({ state: 'OFFLINE' })
    await adapter.connect()
    expect(await adapter.getStatus()).toEqual({ state: 'OFFLINE', detail: 'no reader connected' })
  })

  it('reports READY with the reader name, then "card present" on tap', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    expect(await adapter.getStatus()).toEqual({
      state: 'READY',
      detail: 'ACME PC/SC Reader 01',
    })
    reader.presentCard('04:AA:BB:CC')
    expect(await adapter.getStatus()).toEqual({ state: 'READY', detail: 'card present' })
  })

  it('waitForCard resolves immediately when a card is already present', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    reader.presentCard('04:AA:BB:CC')
    expect(await adapter.waitForCard()).toBe('04:AA:BB:CC')
  })

  it('waitForCard resolves when a card is tapped after the wait begins', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    const pending = adapter.waitForCard()
    reader.presentCard('04:11:22:33')
    expect(await pending).toBe('04:11:22:33')
  })

  it('waitForCard rejects with no reader connected', async () => {
    const { adapter } = setup()
    await adapter.connect()
    await expect(adapter.waitForCard()).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })

  it('waitForCard times out when a reader is present but no card taps', async () => {
    const { adapter, attachReader } = setup(50)
    await adapter.connect()
    const reader = attachReader()
    reader.presentCard('04:AA')
    reader.removeCard() // reader present, card gone
    await expect(adapter.waitForCard()).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })

  it('writes then reads back the payload and verifies it', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    reader.presentCard('04:AA:BB:CC')

    await adapter.write(payload)
    expect(await adapter.read()).toEqual(payload)
    expect(await adapter.verify(payload)).toBe(true)
  })

  it('verify returns false when the chip holds a different card', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    reader.presentCard('04:AA:BB:CC')
    await adapter.write(payload)
    expect(
      await adapter.verify({ cardId: CardId('other'), hospitalNo: HospitalNo('H-999') }),
    ).toBe(false)
  })

  it('read throws when no card is present', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    attachReader() // reader, but no card tapped
    await expect(adapter.read()).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })

  it('read rejects a blank chip (no valid payload)', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    reader.presentCard('04:AA:BB:CC') // fresh chip, memory all zeros
    await expect(adapter.read()).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })

  it('maps a write failure to NFC_ENCODING_FAILED', async () => {
    const { adapter, attachReader } = setup()
    await adapter.connect()
    const reader = attachReader()
    reader.presentCard('04:AA:BB:CC')
    reader.failWrite = true
    await expect(adapter.write(payload)).rejects.toMatchObject({ code: 'NFC_ENCODING_FAILED' })
  })

  it('surfaces a reader-subsystem error as ERROR', async () => {
    const { adapter, main } = setup()
    await adapter.connect()
    main.emit('error', new Error('PC/SC service crashed'))
    expect(await adapter.getStatus()).toEqual({
      state: 'ERROR',
      detail: 'PC/SC service crashed',
    })
  })

  it('disconnect rejects any pending waiter and goes OFFLINE', async () => {
    const { adapter, attachReader } = setup(10_000)
    await adapter.connect()
    attachReader()
    const pending = adapter.waitForCard()
    await adapter.disconnect()
    await expect(pending).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
    expect(await adapter.getStatus()).toEqual({ state: 'OFFLINE' })
  })
})
