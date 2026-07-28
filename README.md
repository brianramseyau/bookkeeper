# Bookkeeper

A self-hosted household finance tracker for two people, replacing a
years-old Excel workbook. Tracks utility bills (with rolling-average
trends), recurring/annual bills, personal subscriptions, category-level
monthly spend, and a "standard month" income vs. expense projection.

Built for a single Docker container on a home server (unRAID) - no cloud
dependency, one SQLite file holds everything.

## Stack

- **API**: AdonisJS 7 + Lucid ORM + SQLite
- **Web**: SvelteKit (Svelte 5) + Tailwind CSS, built as a static SPA and
  served by the API as a single process
- **Auth**: session/cookie-based, one account per person

## Local development

```bash
pnpm install
pnpm --filter api exec node ace migration:run
pnpm --filter api exec node ace db:seed   # creates logins from the workbook's "Users" sheet
pnpm dev:api    # AdonisJS on :3333
pnpm dev:web    # SvelteKit dev server on :5173, proxies /api to :3333
```

Copy `apps/api/.env.example` to `apps/api/.env` and fill in `APP_KEY`
(`node ace generate:key`) and `SEED_WORKBOOK_PATH` (pointing at your
`Joint Account Workbook.xlsx`) before the first run. `db:seed` reads that
workbook's "Users" sheet - columns `Name`, `Email`, `Password`, one row per
login - and creates/updates a user for each row; it's not configured via
individual env vars per person.

### Database

No separate database server to install - it's SQLite via
`better-sqlite3`. In development the file lives at `apps/api/tmp/db.sqlite3`
and is created automatically the first time you run migrations; it's
gitignored, so each clone starts empty until you run the
`migration:run`/`db:seed` steps above. To point at a different file (e.g.
to inspect a copy of the production database locally), set `DB_FILENAME`
in `apps/api/.env` to an absolute or `tmp`-relative path.

`config/database.ts` turns on `PRAGMA foreign_keys = ON` for every
connection (via a `pool.afterCreate` hook, since better-sqlite3 defaults it
off), so the `.onDelete('CASCADE')`/`.onDelete('SET NULL')` declared in the
migrations is enforced by SQLite itself - hard-delete routes
(`*_controller.ts#destroy` for archived categories/bills/subscriptions)
just delete the parent row and let the DB clean up or null out dependents.

Useful scripts (run from the repo root): `pnpm lint`, `pnpm lint:fix`,
`pnpm typecheck`, `pnpm test`, `pnpm format`, `pnpm build`.

### Re-seeding from the workbook (full historical import)

Until this app is on a stable release, the workbook is the source of truth:
the database can be thrown away and rebuilt from it at any time. Category
mappings and other importer decisions live in
`apps/api/commands/import_xlsx.ts` (see e.g. the `ROLLING_RECURRING_BILL_NOTES`
table) - fix them there, not with a one-off SQL update, so a future re-seed
doesn't silently revert the fix.

Order matters - each step depends on the one before it:

```bash
# 1. Stop anything holding the db file open (dev server, container, etc).
#    SQLite here is single-writer; running the import while something
#    else has the file open can deadlock rather than error cleanly.

# 2. From apps/api: drop + recreate the schema, then run the seeders
#    (default categories, users from the workbook's "Users" sheet).
pnpm --filter api exec node ace migration:fresh --seed

# 3. Re-run the historical import from the workbook. --dry-run first to
#    sanity-check parsed counts without writing anything; --truncate makes
#    it safe to re-run against a db that already has import data in it.
pnpm --filter api exec node ace import:xlsx --file="../../Joint Account Workbook.xlsx" --dry-run
pnpm --filter api exec node ace import:xlsx --file="../../Joint Account Workbook.xlsx" --truncate

# 4. Restart whatever you stopped in step 1.
```

`import:xlsx` also takes `--rolling-start-year`/`--rolling-start-month` if
the "Rolling" sheet's first month block ever shifts (see the command's
`--help` for current defaults).

### Demo mode

To show the app to someone without exposing real household data, seed an
ephemeral instance with fictional data instead of importing the workbook:

```bash
DB_FILENAME=/tmp/bookkeeper-demo.sqlite3 pnpm --filter api exec node ace migration:run --force
DB_FILENAME=/tmp/bookkeeper-demo.sqlite3 pnpm --filter api exec node ace demo:seed
```

`demo:seed` creates two fictional users (`jordan@demo.local` /
`taylor@demo.local`, password printed on success) plus a full spread of
categories, utilities with several months of billing history, recurring
bills, personal subscriptions, and income sources - enough for the
Dashboard, Bills, Income, and Monthly pages to look lived-in.

It's a dev-only safety valve, not a general reset button: it refuses to
run with `NODE_ENV=production`, and refuses to run against a database
that already has any users/categories/utilities/bills/subscriptions/income
sources in it, so it can never overwrite real data - point `DB_FILENAME`
at a fresh file first, as above.

### Running tests

The API has a full Japa test suite (unit tests for the xlsx import parsers,
`RollingAverageService`, `StandardMonthService`'s date/frequency helpers,
and every validator; functional/HTTP tests for every controller). It runs
against its own isolated SQLite file (`apps/api/tmp/test.sqlite3`) and seed
credentials defined in the committed `apps/api/.env.test`, so it never
touches your real dev database and needs no extra setup on a fresh clone.

```bash
pnpm --filter api test             # run the suite
pnpm --filter api test:coverage    # run with a coverage report (text + HTML in apps/api/coverage/)
```

The API sits at 100% statement/branch/function/line coverage, with two
deliberate, documented exclusions rather than tests bent out of shape to
force a number:

- The one-time `import:xlsx` command is excluded from the coverage
  target entirely (`--exclude="commands/**"` in `test:coverage`) since
  it's already been run once against the real workbook and
  hand-verified (see the Verification section of the original
  implementation plan), and isn't exercised by the running app
  afterwards.
- A handful of individual lines carry inline `c8 ignore` comments for
  branches that are provably unreachable through any legitimate input -
  e.g. a DB-level `CHECK` constraint that already rules out the values
  a fallback branch exists to handle, or a `BaseSerializer` hook
  required for Lucid pagination support that this app never triggers
  (every table here is small enough to return in full). Each one has a
  comment at the call site explaining why it can't be hit.

The web app (`apps/web`) has a Vitest + `@testing-library/svelte` suite covering
every `$lib` module (API wrappers, formatters, stores) and every route/component,
mocking `$app/navigation` / `$app/state` and the `$lib/api/*` modules per test
rather than hitting a real server. It runs in jsdom with the timezone pinned to
UTC (`vitest.config.ts`) so date-formatting assertions don't depend on the
machine running them.

```bash
pnpm --filter web test             # run the suite
pnpm --filter web test:coverage    # run with a coverage report (text + HTML in apps/web/coverage/)
```

Statement/function/line coverage sits in the high 90s. Branch coverage is
lower (~80%) and isn't chased to 100% the way the API's is - a lot of the
remaining branches are decorative template conditionals (a dark-mode class
ternary, an `{#if}` guarding a value that's already guaranteed non-null by an
enclosing check) rather than business logic, and forcing every one of those
would mean tests bent out of shape to hit a number rather than to verify
behavior.

## Deploying (Docker / unRAID)

1. Copy `.env.example` to `.env`, fill in `APP_KEY` and
   `SEED_WORKBOOK_PATH`. Place your `Joint Account Workbook.xlsx` in the
   appdata data directory (see step 4) so it's reachable at that path
   in-container, e.g. `/app/data/Joint Account Workbook.xlsx`.
2. `docker compose up -d --build`
3. One-time only, to seed and import the historical workbook data (the
   container already ran pending migrations on boot in step 2):

   ```bash
   docker compose exec bookkeeper node ace db:seed
   docker compose exec bookkeeper node ace import:xlsx --file="/app/data/Joint Account Workbook.xlsx"
   ```

   `db:seed` creates logins from the workbook's "Users" sheet (`Name`,
   `Email`, `Password` columns); `import:xlsx` does the historical import
   described in [Re-seeding from the workbook](#re-seeding-from-the-workbook-full-historical-import)
   above - add `--truncate` if re-running this against a container that
   already has import data in it.

4. Point the container's `/mnt/user/appdata/bookkeeper/data` mount at
   wherever you want the data to live on the host - see `docker-compose.yml`.

The container runs a single process: AdonisJS serves both the API and the
pre-built SvelteKit static files, and runs pending migrations on boot.

### Reverse-proxy auto-login (Authentik)

If you already front the container with an
[Authentik](https://goauthentik.io/) proxy provider, the app can trust its
identity headers and skip the password form instead of showing a second
login. This is opt-in and off by default - normal password login always
keeps working, proxied or not.

1. In Authentik, on the proxy provider fronting this app, add a custom
   header property mapping that sends a fixed secret as
   `X-Authentik-Shared-Secret` (see
   [headers sent to upstream applications](https://docs.goauthentik.io/add-secure-apps/providers/proxy/#headers-sent-to-upstream-applications)).
2. Set `AUTHENTIK_PROXY_AUTH_ENABLED=true` and `AUTHENTIK_SHARED_SECRET=`
   (matching the value from step 1) in the container's `.env`.
3. A request carrying the correct secret is auto-logged-in as the local
   user whose email matches the `X-authentik-email` header Authentik sends
   - it must already exist as a login here (see `db:seed` above); Authentik
     doesn't create accounts.

Only enable this if the Authentik proxy is the sole path to the container -
anyone who can reach it directly and knows the shared secret could set
these headers themselves and pick which local account to become.

## Backing up your data

**Everything lives in one SQLite file** - the volume mounted at
`/app/data` in the container (`/mnt/user/appdata/bookkeeper/data` on the
host by default, see `docker-compose.yml`). Back up that directory and
you've backed up the entire app: every bill, category, subscription, and
income entry.

### Built-in backups (recommended)

**On by default** - a daily backup with a 7-day retention window starts
automatically the first time the app runs, no setup required. The
**Tasks** page (`/tasks`) has a **Backup schedule** section where you can
adjust the interval (every 6/12/24/48 hours, or weekly), the retention
window in days, or turn it off entirely - backups past the retention
window are purged automatically. A **Backup now** button next to the
backup list triggers one on demand at any time, and each row has
**Download** and **Delete** actions. Backups are written to
`/app/data/backups` (a `backups` subfolder next to the database), using
SQLite's own online backup API for a consistent snapshot even while the
app is running and writing - so this needs no cron job, sidecar
container, or stopping the app. The schedule runs in the same Node
process that serves the app, checked periodically, so it only fires while
the container is actually running.

### Without the app running

If the container itself is down, or you'd rather not rely on the app's
own scheduler, the same stop/copy or SQLite `.backup` approaches
documented for other SQLite-based self-hosted apps still work here:

```bash
# Stop, copy, restart - simplest, guarantees a consistent copy
docker compose stop bookkeeper
cp -r /mnt/user/appdata/bookkeeper/data /mnt/user/backups/bookkeeper-$(date +%Y-%m-%d)
docker compose start bookkeeper
```

```bash
# Without stopping the container
docker compose exec bookkeeper sh -c \
  "sqlite3 /app/data/bookkeeper.sqlite3 '.backup /app/data/backup.sqlite3'"
docker cp bookkeeper:/app/data/backup.sqlite3 ./bookkeeper-backup-$(date +%Y-%m-%d).sqlite3
docker compose exec bookkeeper rm /app/data/backup.sqlite3
```

On unRAID, the stop/copy approach pairs well with the **CA Backup /
Restore Appdata** plugin, which schedules exactly that stop/copy/start
cycle for any appdata folder.

### Restoring

Stop the container, replace `bookkeeper.sqlite3` (and its `-wal`/`-shm`
files, if present) in the data directory with the backup - either one
downloaded from the Tasks page or copied out via the methods above - then
start the container again.

### Exporting data (not a substitute for a backup)

The **Tasks** page also has an **Export** section that downloads a JSON
snapshot of every table, or individual tables as CSV - handy for opening
in a spreadsheet or feeding into another tool, but it's a point-in-time
snapshot of the data only (no auth, no history), not a way to restore the
app. Use a backup (above) for actual restores.

## Notifications (bill reminders)

Bookkeeper can be installed as a PWA (installable, works from a phone's home
screen) and send real push notifications for bills due soon or overdue -
even when the app isn't open. It's opt-in and per person: each household
member enables it on their own device(s) and chooses which bill types they
care about, independently of each other (e.g. one person might want utility
and recurring bill reminders but not subscriptions, since those are
auto-debited anyway).

- **Per-device opt-in and preferences** - on the **Settings** page (via the
  user icon, top right), each person can enable notifications on any device
  they're logged in on, pick a lead time (remind me N days before due), and
  toggle which bill types (utility bills, recurring bills, subscriptions)
  they want reminders for. A **Send test notification** button confirms the
  device is receiving pushes, and each registered device can be removed
  individually.
- **Instance-wide schedule** - the **Tasks** page has a **Notification
  schedule** section controlling what time of day the shared daily check
  runs (in the container's local timezone, set via the `TZ` env var) - this
  is the only setting that isn't per-person, since it's the one background
  job that checks everyone's due bills at once.
- **Nothing to configure for push itself** - the VAPID key pair Web Push
  needs is generated automatically on first use and stored in the database,
  the same way everything else in this app persists. There's no secret to
  generate or paste into `.env`.
- Utility bills and recurring bills are household-shared, so both opted-in
  people see the same ones; personal subscriptions are always scoped to
  their own owner regardless of who else has notifications enabled.

### Requires HTTPS

Service workers - and the Push API built on them - only work in a "secure
context": HTTPS, or the app being accessed as `localhost`. This is a browser
restriction with no app-level opt-out. A bare `docker compose up` on
unRAID, reached by LAN IP with no reverse proxy, is **not** a secure
context, so this feature won't be available until you put a
TLS-terminating reverse proxy in front of the container (the same kind of
setup already described for [Authentik proxy
auto-login](#reverse-proxy-auto-login-authentik) above - Caddy, Traefik,
an nginx-proxy-manager instance, etc. all work). The Settings page detects
this and explains it in place of the enable button rather than just saying
notifications aren't supported.

## Known gaps / not in v1

### Permanent non-goals

Won't be implemented - deliberate, not deferred:

- **Multi-currency support** - this is a single-currency household
  budget tool (AUD formatting is hardcoded) and will stay that way.
- **Multi-tenant support, general SSO/OIDC integration** - still exactly
  two household accounts, no self-registration, no roles. The one
  exception is
  [Authentik proxy-header auto-login](#reverse-proxy-auto-login-authentik):
  it trusts identity headers from a reverse proxy you already run in front
  of the container to skip the password form for an existing account -
  it's not a general reverse-proxy/SSO framework. Otherwise front the
  container yourself for TLS/auth if you want it.
- **`House Stuff` and `FY25 Bonus` sheets** - one-off/ephemeral sheets
  from the source workbook, permanently disregarded.

### Deferred / future work

Discovered along the way or scoped out of v1, but plausible to add later:

- **ATO tax-bracket auto-lookup for marginal rate** - the Income page's
  non-PAYG income tax section (dividends/share sales/bonuses) takes each
  person's marginal tax rate as a manually-entered percentage per
  financial year. Deriving it automatically instead - extrapolating a
  person's YTD PAYG income against the real ATO tax brackets via an npm
  module - was considered and deliberately deferred: it adds a real
  dependency-currency risk (bracket changes, Medicare levy, etc.) for a
  figure the household is already comfortable entering by hand.
