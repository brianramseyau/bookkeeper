/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Database (falls back to tmp/db.sqlite3 for local dev when unset)
  DB_FILENAME: Env.schema.string.optional(),

  // Seed data (used only by `node ace db:seed`, not read at runtime): path
  // to the .xlsx workbook whose "Users" sheet (Name, Email, Password
  // columns) supplies the logins to create. Optional because user_seeder.ts
  // only runs in development/production (see its `static environment`) -
  // tests use test_user_seeder.ts's hardcoded users instead and never read
  // this var.
  SEED_WORKBOOK_PATH: Env.schema.string.optional(),

  // Authentik reverse-proxy auto-login (opt-in, off by default). When
  // enabled, a request carrying a valid AUTHENTIK_SHARED_SECRET is
  // auto-logged-in as the local user matching the X-authentik-email
  // header, without a password. Only enable this behind a reverse proxy
  // that is the sole path to the app and strips/overwrites these headers
  // on the way in.
  AUTHENTIK_PROXY_AUTH_ENABLED: Env.schema.boolean.optional(),
  AUTHENTIK_SHARED_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),
})
