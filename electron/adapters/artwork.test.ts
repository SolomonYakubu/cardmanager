import { describe, it, expect } from 'vitest'
import { renderBarcodePng, renderQrPng, renderCardHtml, CARD_SIZE } from './artwork'
import { HospitalNo, OriginalityCode } from '../../core/domain/ids'
import type { CardArtwork } from '../../core/ports/printer'

/** The 8-byte PNG signature; proves the bytes are a real raster, not a stub. */
const PNG_MAGIC = '89504e470d0a1a0a'

function decodeDataUri(uri: string): Buffer {
  const m = /^data:image\/png;base64,(.+)$/.exec(uri)
  expect(m, 'expected a base64 PNG data URI').not.toBeNull()
  return Buffer.from(m![1], 'base64')
}

describe('renderBarcodePng', () => {
  it('produces a real PNG as a base64 data URI', async () => {
    const uri = await renderBarcodePng('OC-ABC-123')
    const bytes = decodeDataUri(uri)
    expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_MAGIC)
    expect(bytes.length).toBeGreaterThan(100)
  })

  it('encodes different values into different images', async () => {
    const a = decodeDataUri(await renderBarcodePng('OC-0001'))
    const b = decodeDataUri(await renderBarcodePng('OC-9999'))
    expect(a.equals(b)).toBe(false)
  })
})

describe('renderQrPng', () => {
  it('produces a real PNG as a base64 data URI', async () => {
    const bytes = decodeDataUri(await renderQrPng('https://emr.example/patient/EMR-1'))
    expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_MAGIC)
  })
})

describe('renderCardHtml', () => {
  const artwork: CardArtwork = {
    patientName: 'Jane Doe',
    hospitalNo: HospitalNo('H-000123'),
    emrLink: 'https://emr.example/patient/EMR-1',
    barcodeValue: OriginalityCode('OC-ABC-123'),
  }

  it('renders a CR80-sized, default-background, neon-accent card', async () => {
    const html = await renderCardHtml(artwork)
    expect(html).toContain('<!doctype html>')
    // ISO/IEC 7810 ID-1 page so print/PDF is exactly one card.
    expect(html).toContain(`size: ${CARD_SIZE.widthIn}in ${CARD_SIZE.heightIn}in`)
    expect(html).toContain('background-color: #1a1b20') // fallback dark background
    expect(html).toContain('#d8ff3e') // neon green accent
  })

  it('embeds a real barcode and QR image', async () => {
    const html = await renderCardHtml(artwork)
    const imgs = html.match(/data:image\/png;base64,/g) ?? []
    expect(imgs).toHaveLength(2)
    expect(html).toContain('Jane Doe')
    expect(html).toContain('H-000123')
  })

  it('HTML-escapes patient name and hospital number (no injection)', async () => {
    const html = await renderCardHtml({
      ...artwork,
      patientName: `Ann <O'Brien> & "Co"`,
      hospitalNo: HospitalNo('H&<1>'),
    })
    expect(html).toContain('Ann &lt;O&#39;Brien&gt; &amp; &quot;Co&quot;')
    expect(html).toContain('H&amp;&lt;1&gt;')
    // The raw, unescaped markup must never reach the document.
    expect(html).not.toContain("<O'Brien>")
  })
})
