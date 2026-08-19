import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// `electronSimple` is async in vite-plugin-electron v1, so the config is async.
export default defineConfig(async () => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(await electron({
      // Main process — Node/Electron context. Rebuilt + Electron auto-restarts on change.
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            // NOTE: must be `rolldownOptions`, not `rollupOptions`. On Vite 8
            // (rolldown) the plugin injects a default `build.rolldownOptions`
            // for the main build, and its config shim reads
            // `rolldownOptions || rollupOptions` — so anything we put under
            // `rollupOptions` is silently shadowed. The shim also back-maps
            // `rolldownOptions` to `rollupOptions` on Vite < 8, so this key is
            // the portable choice.
            rolldownOptions: {
              // The native SDKs must NOT be bundled: they load compiled
              // `.node` addons that a bundler can't inline, and whose runtime
              // path search (`bindings`, node-gyp-build) only resolves inside
              // node_modules. Left external, Electron `require()`s them from
              // node_modules at runtime. bwip-js is pure JS, so it bundles fine.
              external: [
                'serialport',
                '@serialport/bindings-cpp',
                'nfc-pcsc',
                '@pokusew/pcsclite',
                'bindings',
                'better-sqlite3',
              ],
            },
          },
        },
      },
      // Preload — the only bridge between renderer and main. Reloads the window on change.
      preload: {
        input: 'electron/preload.ts',
      },
      // Renderer runs with Node integration OFF (see main.ts), so this is left at defaults.
      renderer: {},
    })),
  ],
}))
