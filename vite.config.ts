import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base: the built folder can be served from any sub-path or CDN.
  base: './',
  plugins: [react()],
  // Listen on every interface instead of just localhost: the dev server is
  // reachable from the LAN (Vite prints the network URL) so the game can be
  // opened on a phone for touch-control testing.
  server: {
    host: true,
  },
  // Same for the production build, which is how the game is smoke-tested.
  preview: {
    host: true,
  },
  build: {
    // three.js is ~700 kB minified and it is the engine of the whole game, so a
    // single app bundle is expected; splitting it keeps the app chunk cacheable.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
})
