import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.mts on purpose: tests must NOT trigger the
// electron plugin (no main/preload build during `vitest`). The core layer is
// pure Node, so no jsdom is needed here.
//
// The electron/adapters/*.test.ts suites are included too: those adapters are
// import-clean (no `electron`, no native modules — the SDK is injected), so
// they run under plain Node with hand-written fakes. The Electron-bound sinks
// and the SDK resolver live in separate modules the tests never import.
export default defineConfig({
  test: {
    include: ['core/**/*.test.ts', 'electron/adapters/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
