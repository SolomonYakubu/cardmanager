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
  const formattedDate = (artwork.issuedAt ? new Date(artwork.issuedAt) : new Date())
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, ' / ')

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
  
  .who { display: flex; flex-direction: column; position: absolute; bottom: 0.10in; left: 0.96in; right: 0.10in; }
  .label-title { font-size: 4.2pt; font-weight: 800; letter-spacing: 0.05em; color: #009688; margin-bottom: 0.012in; }
  .label-title.main { font-size: 5pt; }
  .who .name { font-size: 10pt; font-weight: 800; line-height: 1; margin-bottom: 0.05in; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .who .details-row { display: flex; align-items: center; gap: 0.08in; }
  .details-col { display: flex; flex-direction: column; }
  .details-val { font-size: 7pt; font-weight: 700; color: #ffffff; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .divider { width: 1px; height: 0.17in; background-color: rgba(0, 150, 136, 0.6); }

  /* Back Layout */
  .back-left-container {
    position: absolute;
    left: 0.08in;
    top: 52%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 0.05in;
    max-width: 1.45in;
    color: #0f2b48;
  }
  .qr-back-box {
    background: #ffffff;
    padding: 0.025in;
    border-radius: 5px;
    border: 1px solid rgba(15, 43, 72, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .qr-back-img { width: 0.44in; height: 0.44in; border-radius: 2px; display: block; }
  .instructions-col { display: flex; flex-direction: column; gap: 0.025in; color: #0f2b48; overflow: hidden; }
  .inst-row { display: flex; align-items: center; gap: 0.035in; font-size: 3.8pt; font-weight: 700; line-height: 1.15; color: #0f2b48; }
  .inst-row.date-row { font-size: 4.4pt; font-weight: 800; }
  .inst-icon { width: 0.12in; height: 0.12in; flex-shrink: 0; fill: #0f2b48; }

  .barcode-container {
    position: absolute;
    bottom: 0.07in;
    right: 0.12in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 1.38in;
  }
  .barcode-img { height: 0.20in; width: auto; max-width: 100%; object-fit: contain; }

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
          <div class="divider"></div>
          <div class="details-col">
            <div class="label-title">BANK</div>
            <div class="details-val">Moniepoint</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 2: BACK -->
  <div class="page back" style="${artwork.backBackground ? `background-image: url('${artwork.backBackground}');` : ''}">
    <div class="back-left-container">
      <div class="qr-back-box">
        <img class="qr-back-img" src="${qr}" alt="QR code" />
      </div>
      <div class="instructions-col">
        <div class="inst-row date-row">
          <svg class="inst-icon" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zM5 7V5h14v2H5zm2 4h3v3H7v-3zm5 0h3v3h-3v-3zm-5 5h3v3H7v-3zm5 0h3v3h-3v-3z"/></svg>
          <span>Issued: ${formattedDate}</span>
        </div>
        <div class="inst-row">
          <svg class="inst-icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span>Always present this card during registration and consultation.</span>
        </div>
        <div class="inst-row">
          <svg class="inst-icon" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
          <span>Report lost card immediately.</span>
        </div>
        <div class="inst-row">
          <svg class="inst-icon" viewBox="0 0 24 24"><path d="M19 10.5h-5.5V5c0-.55-.45-1-1-1h-1c-.55 0-1 .45-1 1v5.5H5c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h5.5V19c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-5.5H19c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1z"/></svg>
          <span>In case of emergency, bring this card to any UATH department.</span>
        </div>
      </div>
    </div>
    <div class="barcode-container">
      <img class="barcode-img" src="${barcode}" alt="Originality code" />
      <span style="font-size:3pt;color:rgba(255,255,255,0.7);font-weight:500;letter-spacing:0.3px;margin-top:2px;">Powered by Blueguava &amp; Xenolink</span>
    </div>
  </div>

</body>
</html>`
}
