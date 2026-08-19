import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  SerialBarcodeScanner,
  type SerialPortCtor,
  type ReadlineParserCtor,
  type ParserLike,
} from './serial-barcode-scanner'

/** Fake `serialport` port: an EventEmitter that opens (or errors) on next tick. */
class FakePort extends EventEmitter {
  isOpen = false
  opts: { path: string; baudRate: number; autoOpen?: boolean } | null = null
  behavior: 'open' | 'error' = 'open'
  openError = 'no such device'

  pipe(dest: ParserLike): ParserLike {
    return dest
  }

  close(cb?: (err?: Error | null) => void): void {
    this.isOpen = false
    this.emit('close')
    cb?.(null)
  }

  /** Simulate the port finishing its async open (or failing to). */
  fireOpen(): void {
    if (this.behavior === 'error') {
      this.emit('error', new Error(this.openError))
    } else {
      this.isOpen = true
      this.emit('open')
    }
  }
}

/** Fake `@serialport/parser-readline`: the test pushes decoded lines through it. */
class FakeParser extends EventEmitter {
  opts: { delimiter?: string } | null = null
}

function setup(behavior: 'open' | 'error' = 'open') {
  const port = new FakePort()
  port.behavior = behavior
  const parser = new FakeParser()

  const SerialPort = function (
    this: unknown,
    opts: { path: string; baudRate: number; autoOpen?: boolean },
  ) {
    port.opts = opts
    queueMicrotask(() => port.fireOpen())
    return port
  } as unknown as SerialPortCtor

  const ReadlineParser = function (this: unknown, opts?: { delimiter?: string }) {
    parser.opts = opts ?? null
    return parser
  } as unknown as ReadlineParserCtor

  const scanner = new SerialBarcodeScanner({
    SerialPort,
    ReadlineParser,
    path: '/dev/tty.fake',
    scanTimeoutMs: 100,
  })
  return { scanner, port, parser }
}

describe('SerialBarcodeScanner', () => {
  it('connects when the port opens and reports READY with the path', async () => {
    const { scanner } = setup()
    await scanner.connect()
    expect(await scanner.getStatus()).toEqual({ state: 'READY', detail: '/dev/tty.fake' })
  })

  it('resolves scan() with the next scanned line', async () => {
    const { scanner, parser } = setup()
    await scanner.connect()
    const pending = scanner.scan()
    parser.emit('data', 'OC-1')
    expect(await pending).toBe('OC-1')
  })

  it('returns a line that arrived before scan() was called', async () => {
    const { scanner, parser } = setup()
    await scanner.connect()
    parser.emit('data', 'OC-2')
    expect(await scanner.scan()).toBe('OC-2')
  })

  it('trims whitespace and ignores blank lines', async () => {
    const { scanner, parser } = setup()
    await scanner.connect()
    parser.emit('data', '   ') // blank → ignored
    parser.emit('data', '  OC-3  ') // trimmed
    expect(await scanner.scan()).toBe('OC-3')
  })

  it('accepts a Buffer line', async () => {
    const { scanner, parser } = setup()
    await scanner.connect()
    parser.emit('data', Buffer.from('OC-BUF'))
    expect(await scanner.scan()).toBe('OC-BUF')
  })

  it('times out when no code is scanned', async () => {
    const { scanner } = setup()
    await scanner.connect()
    await expect(scanner.scan({ timeoutMs: 30 })).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })

  it('rejects connect() when the port fails to open', async () => {
    const { scanner } = setup('error')
    await expect(scanner.connect()).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })

  it('fails pending scans and goes ERROR on a port error after open', async () => {
    const { scanner, port } = setup()
    await scanner.connect()
    const pending = scanner.scan()
    port.emit('error', new Error('cable yanked'))
    await expect(pending).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
    expect(await scanner.getStatus()).toMatchObject({ state: 'ERROR', detail: 'cable yanked' })
  })

  it('disconnect fails pending scans, closes the port, and blocks further scans', async () => {
    const { scanner, port } = setup()
    await scanner.connect()
    const pending = scanner.scan()
    await scanner.disconnect()
    await expect(pending).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
    expect(port.isOpen).toBe(false)
    expect(await scanner.getStatus()).toMatchObject({ state: 'OFFLINE' })
    await expect(scanner.scan()).rejects.toMatchObject({ code: 'HARDWARE_ERROR' })
  })
})
