/**
 * Card artwork rendering (real, verifiable output).
 *
 * Turns a vendor-neutral {@link CardArtwork} into a print-ready HTML document at
 * CR80 card size (the ISO/IEC 7810 ID-1 format every badge printer expects),
 * with a genuine Code-128 barcode (the originality code) and a QR code (the EMR
 * deep link) rendered by bwip-js.
 *
 * bwip-js is pure JavaScript — no native bindings — so this module loads and
 * runs anywhere: Electron main, plain Node, and Vitest. That is what makes the
 * barcode/QR path the one piece of the hardware story that is fully testable
 * without a device: we render real PNGs and can decode/inspect the bytes.
 *
 * Imported from the explicit `bwip-js/node` subpath: under `moduleResolution:
 * bundler` TypeScript does not activate the package's top-level `node`/`electron`
 * export conditions, so the bare specifier would resolve to the browser types
 * (no `toBuffer`). The subpath's `types` condition points straight at the Node
 * build. At runtime `require('bwip-js/node')` yields the same Node build.
 */

import * as bwipjs from 'bwip-js/node'
import type { CardArtwork } from '../../core/ports/printer'

/** Card dimensions: ISO/IEC 7810 ID-1 ("CR80"), the credit-card / badge size. */
export const CARD_SIZE = { widthIn: 3.375, heightIn: 2.125 } as const

/** Render a bwip-js symbol to a base64 PNG data URI (browser-embeddable). */
async function pngDataUri(opts: bwipjs.RenderOptions): Promise<string> {
  const png = await bwipjs.toBuffer(opts)
  return `data:image/png;base64,${png.toString('base64')}`
}

/**
 * Code-128 barcode carrying the originality code — the value the operator scans
 * at print-verify so the service can recompute and compare it (spec §7).
 */
export function renderBarcodePng(value: string): Promise<string> {
  return pngDataUri({
    bcid: 'code128',
    text: value,
    scale: 3,
    height: 9,
    includetext: true,
    textxalign: 'center',
    textsize: 7,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 1,
    paddingheight: 1,
  })
}

/** QR code carrying the EMR deep link scanned at check-in (spec §8). */
export function renderQrPng(value: string): Promise<string> {
  return pngDataUri({
    bcid: 'qrcode',
    text: value,
    scale: 3,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 1,
    paddingheight: 1,
  })
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))

/**
 * Compose the full, print-ready card as a self-contained HTML document.
 *
 * `@page { size }` + `preferCSSPageSize` (set by the printer sink) makes the
 * physical/PDF page exactly one card, so there are no margins to trim. White
 * background with the same green accent as the operator console.
 */
export async function renderCardHtml(artwork: CardArtwork): Promise<string> {
  const [barcode, qr] = await Promise.all([
    renderBarcodePng(artwork.barcodeValue),
    renderQrPng(artwork.emrLink), // Used for both front and back
  ])
  const name = escapeHtml(artwork.patientName)
  const hospitalNo = escapeHtml(artwork.hospitalNo)

  // Dynamic text colors based on custom background presence
  const hasBg = !!artwork.frontBackground

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${CARD_SIZE.widthIn}in ${CARD_SIZE.heightIn}in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: ${CARD_SIZE.widthIn}in; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #ffffff; }
  
  .page {
    position: relative;
    width: ${CARD_SIZE.widthIn}in;
    height: ${CARD_SIZE.heightIn}in;
    page-break-after: always;
    overflow: hidden;
    background-color: #1a1b20;
    background-size: cover;
    background-position: center;
  }

  .content-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0.18in 0.18in;
  }

  /* Front Default Header */
  .accent { position: absolute; top: 0; left: 0; right: 0; height: 0.08in; background: #d8ff3e; }
  
  .who { display: flex; flex-direction: column; position: absolute; bottom: 0.13in; left: 0.96in; }
  .label-title { font-size: 5pt; font-weight: 800; letter-spacing: 0.05em; color: #009688; margin-bottom: 0.016in; }
  .label-title.main { font-size: 5.5pt; }
  .who .name { font-size: 11pt; font-weight: 800; line-height: 1; margin-bottom: 0.067in; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 2.1in; }
  .who .details-row { display: flex; align-items: center; gap: 0.133in; }
  .details-col { display: flex; flex-direction: column; }
  .details-val { font-size: 8.5pt; font-weight: 700; color: #ffffff; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .divider { width: 1px; height: 0.233in; background-color: rgba(0, 150, 136, 0.6); }

  /* Back Layout */
  .qr-back-container { position: absolute; left: 0.23in; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; background: #ffffff; padding: 0.08in; border-radius: 8px; }
  .qr-back-img { width: 0.65in; height: 0.65in; border-radius: 2px; }

  .barcode-container { position: absolute; bottom: 0.08in; right: 0.20in; display: flex; justify-content: center; max-width: 60%; }
  .barcode-img { height: 0.22in; width: auto; max-width: 100%; object-fit: contain; }

</style>
</head>
<body>
  
  <!-- PAGE 1: FRONT -->
  <div class="page front" style="${artwork.frontBackground ? `background-image: url('${artwork.frontBackground}');` : ''}">
    ${!hasBg ? '<div class="accent"></div>' : ''}
    <div class="content-overlay">
      <div class="who">
        <div class="label-title main">PATIENT NAME</div>
        <div class="name">${name}</div>
        <div class="details-row">
          <div class="details-col">
            <div class="label-title">HOSPITAL NO.</div>
            <div class="details-val">${hospitalNo}</div>
          </div>
          <div class="divider"></div>
          <div class="details-col">
            <div class="label-title">WALLET NO.</div>
            <div class="details-val">${escapeHtml(artwork.walletNo || 'AY 00000000 00')}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 2: BACK -->
  <div class="page back" style="${artwork.backBackground ? `background-image: url('${artwork.backBackground}');` : ''}">
    <div class="qr-back-container">
      <img class="qr-back-img" src="${qr}" alt="QR code" />
    </div>
    <div class="barcode-container">
      <img class="barcode-img" src="${barcode}" alt="Originality code" />
    </div>
  </div>

</body>
</html>`
}
