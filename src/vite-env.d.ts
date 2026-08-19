/// <reference types="vite/client" />

// Single source of truth for the bridge shapes: reuse the preload/contract
// types so renderer, preload, and main can never drift apart.
import type { ElectronAPI } from '../electron/preload'
import type { CardApi } from '../electron/ipc/contract'

declare global {
  interface Window {
    electronAPI: ElectronAPI
    cardApi: CardApi
  }
}
