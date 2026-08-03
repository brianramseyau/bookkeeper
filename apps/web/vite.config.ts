import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // Proxy API calls to the AdonisJS dev server so the browser only ever
    // talks to one origin - keeps session/CSRF cookies same-origin in dev,
    // matching how the single production container serves both.
    // API_PROXY_TARGET lets the Playwright e2e suite point this at an
    // isolated API instance on a different port instead of the normal dev
    // server (see root playwright.config.ts).
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
})
