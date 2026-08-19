import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'node:path'
import { createRuntime } from './runtime'
import { registerCardHandlers } from './ipc/register'

// Built output layout:
//   dist-electron/main.js      <- this file (compiled)
//   dist-electron/preload.js   <- preload (compiled)
//   dist/index.html            <- renderer (production)
process.env.APP_ROOT = path.join(__dirname, '..')

// Set by vite-plugin-electron during `vite` (dev). Absent in a packaged build.
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

// ── TEMP DIAGNOSTICS (remove after) ──────────────────────────────────
const fsd = require('node:fs')
const osd = require('node:os')
const DIAG_PATH = path.join(osd.homedir(), 'cardmanage-diag.log')
const diag = (m: string) => {
  const line = `${new Date().toISOString()} ${m}\n`
  try {
    process.stderr.write(`[DIAG] ${line}`)
  } catch {
    /* ignore */
  }
  try {
    fsd.appendFileSync(DIAG_PATH, line)
  } catch {
    /* ignore */
  }
}
diag(`=== main.js loaded; DEV_URL=${VITE_DEV_SERVER_URL ?? '(none)'}`)
// ── END TEMP DIAGNOSTICS ─────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  console.error(error)
  const { dialog } = require('electron')
  if (app.isReady()) {
    dialog.showErrorBox('Application Crash', error.stack || error.message || String(error))
  }
})

let win: BrowserWindow | null = null

function createWindow() {
  Menu.setApplicationMenu(null)

  const iconPath = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT || '', 'public', 'logo.png')
    : path.join(RENDERER_DIST, 'logo.png')

  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#f8fafc',
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Security posture required by the spec: the renderer never gets direct
      // Node/hardware access — everything crosses the preload bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // ── TEMP DIAGNOSTICS (remove after) ──────────────────────────────────
  diag(`createWindow start; RENDERER_DIST=${RENDERER_DIST}`)
  const wc = win.webContents
  wc.on('did-fail-load', (...a: unknown[]) => diag(`did-fail-load ${JSON.stringify(a.slice(1))}`))
  wc.on('did-finish-load', () => diag('did-finish-load'))
  wc.on('dom-ready', () => diag('dom-ready'))
  wc.on('render-process-gone', (...a: unknown[]) => diag(`render-process-gone ${JSON.stringify(a.slice(1))}`))
  wc.on('preload-error', (...a: unknown[]) => diag(`preload-error ${JSON.stringify(a.slice(1))}`))
  wc.on('console-message', (...a: unknown[]) =>
    diag(`console ${a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' | ')}`),
  )
  // ── END TEMP DIAGNOSTICS ─────────────────────────────────────────────

  win.once('ready-to-show', () => {
    diag('ready-to-show')
    win?.maximize()
    win?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    const indexHtml = path.join(RENDERER_DIST, 'index.html')
    diag(`loadFile ${indexHtml} exists=${fsd.existsSync(indexHtml)}`)
    win.loadFile(indexHtml)
  }
}

// ── IPC: the renderer's capability surface (spec §5) lands here. ───────────
// Platform bridge (versions/ping) stays here; the domain surface (patients,
// issuance, check-in, lifecycle) is registered from the composition root.
ipcMain.handle('app:getVersions', () => ({
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  v8: process.versions.v8,
}))

ipcMain.handle('app:ping', () => 'pong')

app.whenReady().then(async () => {
  diag('whenReady: start')
  let runtime
  try {
    runtime = await createRuntime(app.getPath('userData'))
    diag('whenReady: createRuntime done')
  } catch (err) {
    diag(`whenReady: createRuntime THREW ${err instanceof Error ? err.stack : String(err)}`)
    throw err
  }
  registerCardHandlers(runtime)
  diag('whenReady: handlers registered, creating window')
  createWindow()

  // Startup diagnostics: which device each port resolved to (real vs simulated).
  // Lets an operator confirm, at a glance in the logs, whether attached hardware
  // was picked up or the app fell back to simulation.
  const describe = (d: { kind: string; mode: string; detail?: string }): string =>
    `${d.kind} [${d.mode}${d.detail ? `: ${d.detail}` : ''}]`
  const { nfc, printer, barcode } = runtime.hardware
  console.log(
    `[cardmanage] ready — NFC: ${describe(nfc)} | ` +
      `Printer: ${describe(printer)} | Barcode: ${describe(barcode)}`,
  )
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})
