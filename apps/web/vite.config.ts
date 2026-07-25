import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	server: {
		// Proxy API calls to the AdonisJS dev server so the browser only ever
		// talks to one origin - keeps session/CSRF cookies same-origin in dev,
		// matching how the single production container serves both.
		proxy: {
			'/api': {
				target: 'http://localhost:3333',
				changeOrigin: true
			}
		}
	}
});
