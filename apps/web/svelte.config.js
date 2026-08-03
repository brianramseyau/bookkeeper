import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
  },
  kit: {
    // Not named index.html on purpose - serve-static (used by the API's
    // static middleware) auto-serves a literal index.html for a directory
    // request, which would let `GET /` skip the router (and with it the
    // shield CSP middleware that stamps a nonce onto this file's inline
    // <script> tags) entirely. See the SPA fallback route in
    // apps/api/start/routes.ts, which reads this file by name.
    adapter: adapter({ fallback: 'app.html' }),
  },
}
