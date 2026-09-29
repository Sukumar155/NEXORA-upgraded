import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Proxy the backend bridge (server/sos-server.mjs) so the frontend can
    // call /api/* same-origin. Start it with: npm run dev:all
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` serves the production build but does NOT inherit
  // `server.proxy`, so every /api/* call 404'd against the static bundle.
  // The same proxy is declared here so `npm run preview` works too.
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
