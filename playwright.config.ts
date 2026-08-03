import { defineConfig, devices } from '@playwright/test'

// Isolated ports so the e2e suite never collides with a dev server the user
// already has running on 3333/5173 (AGENTS.md: the dev server should always
// be left running, so e2e must not attach to or disturb it).
const API_PORT = 3334
const WEB_PORT = 5174

export const E2E_BASE_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      // Fresh, disposable SQLite file per run, seeded with `demo:seed`'s
      // fictional showcase data (see commands/demo_seed.ts) - hardcoded
      // login, no workbook fixture needed, and real content on every page
      // for the specs to assert against. Never the dev/prod db.
      // `migration:run` regenerates database/schema.ts unformatted as a
      // side effect regardless of which DB it targets - reformat it back
      // to match the committed version so running the e2e suite doesn't
      // leave a spurious diff in the working tree.
      command:
        'pnpm --filter api exec bash -c "rm -f tmp/e2e.sqlite3* && node ace migration:run --force && npx prettier --write database/schema.ts database/schema_rules.ts && node ace demo:seed && node ace serve"',
      url: `http://localhost:${API_PORT}/api/me`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        HOST: 'localhost',
        APP_URL: `http://localhost:${API_PORT}`,
        DB_FILENAME: './tmp/e2e.sqlite3',
      },
    },
    {
      command: `pnpm --filter web exec vite dev --port ${WEB_PORT} --strictPort`,
      url: E2E_BASE_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        API_PROXY_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  ],
})
