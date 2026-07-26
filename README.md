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
pnpm --filter api exec node ace db:seed   # creates the two logins from .env
pnpm dev:api    # AdonisJS on :3333
pnpm dev:web    # SvelteKit dev server on :5173, proxies /api to :3333
```

Copy `apps/api/.env.example` to `apps/api/.env` and fill in `APP_KEY`
(`node ace generate:key`) and the seed credentials before the first run.

Useful scripts (run from the repo root): `pnpm lint`, `pnpm lint:fix`,
`pnpm typecheck`, `pnpm format`, `pnpm build`.

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

## Deploying (Docker / unRAID)

1. Copy `.env.example` to `.env`, fill in `APP_KEY` and the seed
   credentials.
2. `docker compose up -d --build`
3. One-time only: `docker compose exec bookkeeper node ace db:seed` to
   create the two logins.
4. Point the container's `/mnt/user/appdata/bookkeeper/data` mount at
   wherever you want the data to live on the host - see `docker-compose.yml`.

The container runs a single process: AdonisJS serves both the API and the
pre-built SvelteKit static files, and runs pending migrations on boot.

## Backing up your data

**Everything lives in one SQLite file** - the volume mounted at
`/app/data` in the container (`/mnt/user/appdata/bookkeeper/data` on the
host by default, see `docker-compose.yml`). Back up that directory and
you've backed up the entire app: every bill, category, subscription, and
income entry.

### Recommended: stop, copy, restart

The simplest reliable method - guarantees a consistent copy since nothing
is writing to the database while it's stopped:

```bash
docker compose stop bookkeeper
cp -r /mnt/user/appdata/bookkeeper/data /mnt/user/backups/bookkeeper-$(date +%Y-%m-%d)
docker compose start bookkeeper
```

On unRAID, this pairs well with the **CA Backup / Restore Appdata**
plugin, which schedules exactly this stop/copy/start cycle for any
appdata folder.

### Without stopping the container

SQLite's own backup command produces a consistent snapshot even while the
app is running and writing:

```bash
docker compose exec bookkeeper sh -c \
  "sqlite3 /app/data/bookkeeper.sqlite3 '.backup /app/data/backup.sqlite3'"
docker cp bookkeeper:/app/data/backup.sqlite3 ./bookkeeper-backup-$(date +%Y-%m-%d).sqlite3
docker compose exec bookkeeper rm /app/data/backup.sqlite3
```

### Restoring

Stop the container, replace `bookkeeper.sqlite3` (and its `-wal`/`-shm`
files, if present) in the data directory with the backup, then start the
container again.

### Exporting data (not a substitute for a backup)

The **Export** page in the app (`/export`) downloads a JSON snapshot of
every table, or individual tables as CSV - handy for opening in a
spreadsheet or feeding into another tool, but it's a point-in-time
snapshot of the data only (no auth, no history), not a way to restore the
app. Use the SQLite file for actual backups.

## Known gaps / not in v1

### Permanent non-goals

Won't be implemented - deliberate, not deferred:

- **Multi-currency support** - this is a single-currency household
  budget tool (AUD formatting is hardcoded) and will stay that way.
- **Reverse-proxy/SSO integration** - front the container yourself for
  TLS/auth if you want it.
- **`House Stuff` and `FY25 Bonus` sheets** - one-off/ephemeral sheets
  from the source workbook, permanently disregarded.

### Deferred / future work

Discovered along the way or scoped out of v1, but plausible to add later:

- **`Non-PAYG Income Tax` sheet not yet imported** - the one remaining
  excluded sheet that's still expected to be modeled eventually.
- **No notifications/reminders** for upcoming or overdue bills - you have
  to check the Dashboard or Recurring Bills page yourself.
- **No frontend test coverage** - the SvelteKit app (`apps/web`) has no
  test tooling installed and no automated tests. The API (`apps/api`) sits
  at 100% statement/branch/function/line coverage (see "Running tests"
  above), with two deliberate, documented exclusions rather than tests
  bent out of shape to force a number:
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
