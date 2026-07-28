# Bookkeeper — Household Finance Tracker

_Replacing `Joint Account Workbook.xlsx` with a self-hosted AdonisJS + SvelteKit app in one Docker container on unRAID._

## Context

The user (and their wife) have tracked household finances for years in `Joint Account Workbook.xlsx`: utility bills with year-over-year trend, annual/recurring bills (vendor, amount, due date), personal per-person subscriptions, category-level monthly actuals (pulled once a month from their Westpac banking app), and a "standard month" model that projects income vs. expenses before a month starts and tracks it against reality during the month. Previous apps (Pocketbook, Firefly III) were adequate but too heavyweight for this narrow, two-person use case. The goal is a purpose-built, self-hosted replacement — SQLite-backed, Docker-deployed on their unRAID box, MVC-style, strictly typed — that keeps the parts of the spreadsheet workflow that work (utility trending being the top priority) without the general-ledger complexity of Firefly III.

This is a **greenfield project** — the directory currently contains only the reference `.xlsx` file. Data model and import logic below were derived by directly inspecting the real workbook (not assumed), including cross-referencing values across sheets to resolve ambiguities (e.g. confirming the `Rolling` sheet's unlabeled month blocks correspond to Feb–Sep 2026 by matching its Electricity Bill actuals against the `Electricity` sheet's own Feb/Mar 2026 values).

Confirmed decisions (from prior discussion with the user):

- **Backend**: AdonisJS (MVC, TypeScript) + Lucid ORM + SQLite.
- **Frontend**: SvelteKit.
- **Auth**: individual accounts for the two users (not a shared login).
- **Categories**: user-defined records, seeded with sensible defaults, not hardcoded enums.
- **Historical data**: import from the xlsx via a one-time script, so trends/averages work from day one.
- **Out of scope for v1**: the `Non-PAYG Income Tax`, `House Stuff`, and `FY25 Bonus` sheets; no notifications/reminders; no multi-currency; no reverse-proxy/SSO integration (user fronts it themselves).
- **"Amber"** is the household dog — her cost-breakdown sheet feeds a "Dog" spending category, not a separate user/profile.
- **MVP priority order**: utility bills → annual bills → personal subscriptions → category monthly actuals → standard-month income/expense view.

---

## 1. Repo / Project Structure

Monorepo (pnpm workspaces), two apps, no shared package at this size:

```
bookkeeper/
├── apps/
│   ├── api/                      # AdonisJS 6 app
│   │   ├── app/{controllers,models,services,validators,middleware}/
│   │   ├── commands/              # node ace commands, incl. import:xlsx
│   │   ├── config/
│   │   ├── database/{migrations,seeders}/
│   │   ├── start/routes.ts
│   │   └── package.json
│   └── web/                       # SvelteKit app
│       ├── src/{routes,lib}/
│       ├── svelte.config.js       # adapter-static
│       └── package.json
├── Dockerfile
├── docker-compose.yml
├── eslint.config.mjs              # single shared flat config
├── .prettierrc.json
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```

### Single-container strategy: one process

**SvelteKit builds as a fully static SPA (`@sveltejs/adapter-static`, `export const ssr = false` at the root layout), served by AdonisJS's static middleware. AdonisJS is the only running process.**

This is a private, authenticated, 2-user app with no SEO/first-paint requirement, so SSR buys nothing. Running two Node processes in one container would need a supervisor (pm2/s6) purely to keep both alive plus inter-process proxying — unjustified complexity here. Instead: build the SvelteKit output into `apps/api/public/`, serve API routes under `/api/*`, and add a catch-all SPA fallback (serve `index.html` for unmatched non-`/api` GETs, so client-side routing survives a refresh/deep link).

Same-origin frontend/backend means **cookie-based session auth** (`@adonisjs/auth` session guard, `SESSION_DRIVER=cookie`) rather than bearer tokens in localStorage — simpler and not XSS-exposed.

---

## 2. Database Schema (Lucid migrations)

SQLite, mounted volume. Amounts as `decimal(10,2)` (the source workbook itself already carries float-rounded averages like `483.8886724`; integer-cents would be more "correct" but is unnecessary here).

**`users`**: id, full_name, email (unique), password (hashed via `withAuthFinder`), display_color (nullable), timestamps. No role/admin column — both users are peers.

**`categories`**: id, name (unique), color (nullable), sort_order, is_active (soft-archive, never hard delete), timestamps. A broad, cross-cutting classification tag — "Groceries", "Household", "Utilities", "Subscriptions", "Fees" — kept separate from bill names; see the corrected data model note below.

**`utilities`**: id, name (the bill name — "Electricity", "Gas", "Water"), category_id (FK → categories.id, nullable — e.g. "Utilities"), is_active, timestamps. Parent entity for the month×year matrix (replaces using `categories` itself as the utility grouping — see note below).

**`utility_bills`**: id, utility_id (FK → utilities.id), year, month (1–12), amount (NOT NULL — a missing row means "not yet billed"), notes (nullable), timestamps. Unique index `(utility_id, year, month)`.

**`recurring_bills`** _(renamed from the earlier draft's "annual_bills" — frequency now covers more than annual)_: id, name (bill name — "Costco Membership", "VPN", "Kayo"), category_id (FK → categories.id, nullable — e.g. "Subscriptions", "Fees", "Household"), amount, frequency (`'monthly'|'quarterly'|'biannual'|'annual'|'custom'`), custom_interval_value (integer, nullable — used when frequency='custom'), custom_interval_unit (`'days'|'weeks'|'months'`, nullable — e.g. value=2/unit='weeks' for fortnightly), due_day (integer, nullable), due_month (integer 1–12, nullable), due_year (integer, nullable), next_due_on (date, nullable — the one authoritative concrete date), is_active, notes, timestamps.

**`user_subscriptions`**: id, user_id (FK), name, category_id (FK → categories.id, nullable — e.g. "Subscriptions"), amount, day_of_month (nullable), include_in_standard_month (bool, default true), is_active, notes, timestamps.

**`category_monthly_actuals`**: id, category_id (FK — the category itself is the tracked thing here, e.g. "Groceries", "Transport"), occurred_on (date), amount (NOT NULL), notes (nullable), timestamps. Index `(category_id, occurred_on)`. No unique constraint — allows correction entries later.

**Corrected data model — bill name vs. category, and Annual sheet date fields** (per user correction on the initial draft):

- **`categories`** is a small, broad, cross-cutting classification tag the user defines directly — e.g. "Groceries", "Household", "Utilities", "Subscriptions", "Fees" — used for reporting/spend-by-category (their primary tracking method today, done by hand from the Westpac app). It has **no `kind` discriminator** in the corrected model; it's just `id, name (unique), color (nullable), sort_order, is_active, timestamps`.
- A **bill name** ("Electricity", "Costco Membership", "Kayo", "Adobe") is a distinct concept from its category and lives on the specific record (`utilities.name`, `recurring_bills.name`, `user_subscriptions.name`) — each of those optionally tags a `category_id` for reporting. `category_monthly_actuals` is the one exception: there the category itself _is_ the tracked thing (it mirrors a Westpac spend category directly, e.g. logging a monthly Groceries total), so no separate bill name is needed there.
- The **`Annual` sheet's date columns are not what the initial draft assumed.** Confirmed by inspecting all 14 rows: "Day/Month" and "Year" are exactly what they're named — a recurring day-of-month/month-of-year pattern (the year embedded in that cell's underlying date value is stale/arbitrary, e.g. Costco's Day/Month cell is dated 2025 even though its Next is 2026) plus an optional year override (only populated for VPN in the source data). These combine to produce **"Next"**, the sheet's only column holding a real, currently-correct date. The schema reflects this: `due_day`/`due_month`/`due_year` capture the recurring pattern, `next_due_on` is the one authoritative date, populated directly from "Next" on import.

**`income_sources`**: id, user_id (FK), name, expected_amount (drives the _projected_ standard-month view), is_active, notes, timestamps.

**`income_entries`**: id, income_source_id (FK, nullable), user_id (FK, nullable — fallback when not linked to a defined source), year, month, received_on (date, nullable), amount, note (nullable), timestamps.

**Alter `categories`** (added when Phase 5 needs it, not before): `budget_amount` (nullable manual override target — e.g. cap Groceries at a target; falls back to 12‑month rolling average of `category_monthly_actuals` if null), `include_in_standard_month` (bool, default true — lets a category be tracked but excluded from the recurring projection, e.g. a one-off). Note: fixed recurring items with their own due date (Mortgage, Internet Bill, Health Insurance) belong in `recurring_bills` (which already carries `due_day`/`amount` natively), not as a category — categories are for variable, logged-after-the-fact spend, so no `day_of_month_due` is needed here.

Models in `apps/api/app/models/`: `user.ts`, `category.ts`, `utility.ts`, `utility_bill.ts`, `recurring_bill.ts`, `user_subscription.ts`, `category_monthly_actual.ts`, `income_source.ts`, `income_entry.ts` — standard Lucid `belongsTo`/`hasMany` relations mirroring the FKs above.

---

## 3. API Surface

Session auth (`@adonisjs/auth`, cookie driver). All routes below except auth require the `auth` middleware. Base path `/api`.

- **`AuthController`**: `POST /login`, `POST /logout`, `GET /me`
- **`UsersController`**: `GET /users` (id/name/color for dropdowns), `PATCH /users/:id` (self only)
- **`CategoriesController`**: `GET /categories`, `POST`, `PATCH /:id`, `DELETE /:id` (soft delete)
- **`UtilitiesController`**: `GET /utilities`, `POST`, `PATCH /:id`, `DELETE /:id` (soft delete) — manage the small set of utility bill names (Electricity, Gas, Water, ...)
- **`UtilityBillsController`** + `RollingAverageService`: `GET /utilities/:utilityId/bills` (full month×year matrix), `PUT /utilities/:utilityId/bills/:year/:month` (upsert one cell), `DELETE /utility-bills/:id`, `GET /utilities/:utilityId/trend` (last 12 months, rolling average, up/down indicator)
- **`RecurringBillsController`**: standard CRUD + `GET /recurring-bills/upcoming` (sorted by next_due_on, "due within 30 days" flag)
- **`SubscriptionsController`**: standard CRUD (filter `?userId=`) + `GET /subscriptions/summary` (per-user totals)
- **`CategoryActualsController`**: `GET /categories/:id/actuals?year=&month=`, `POST`, `PATCH /category-actuals/:id`, `DELETE /:id`, `GET /categories/:id/trend` (reuses `RollingAverageService`)
- **`IncomeSourcesController`** / **`IncomeEntriesController`**: standard CRUD, entries filterable by `?year=&month=&userId=`
- **`StandardMonthController`** + `StandardMonthService`: `GET /standard-month?year=&month=` → aggregates utility rolling averages, `recurring_bills` amortized by frequency (one collapsed "Recurring Bills (avg)" line, mirroring the source `Monthly` sheet, each retaining its own `due_day`/`due_month` for ordering), per-user subscription totals, and category-level actuals (budget override or rolling average), each with actual-so-far when viewing the current month
- **`DashboardController`** (Phase 6): `GET /dashboard/summary` — headline tiles + sparkline data

---

## 4. SvelteKit Route Structure

```
src/routes/
├── +layout.svelte            # auth guard via GET /api/me; redirects to /login on 401
├── login/+page.svelte        # only public page
├── +page.svelte              # dashboard / redirect target
├── utilities/(+page.svelte | [utilityId]/+page.svelte)   # cards + trend, then month×year grid
├── recurring-bills/+page.svelte
├── subscriptions/+page.svelte   # per-user tabs, item list + running total
├── categories/(+page.svelte | [categoryId]/+page.svelte)  # manage + per-category actuals/trend
├── month/+page.svelte         # standard month: year/month picker, projected vs actual-so-far
└── settings/+page.svelte      # password, income sources, display prefs
```

`src/lib/api.ts` — thin fetch wrapper, `credentials: 'include'`, relative `/api` base, centralized 401→redirect handling. `src/lib/stores/auth.ts` — writable store for the current user, populated by the root layout on mount.

---

## 5. Historical Data Import

Ace command: **`node ace import:xlsx --file="./Joint Account Workbook.xlsx"`** (`apps/api/commands/import_xlsx.ts`), using `exceljs`. Parsers in `apps/api/app/services/import/`, one per sheet-shape (shared where shapes repeat):

- `parse_matrix_sheet.ts` — `Electricity` / `Gas` / `Water` (Month×Year → `utilities` + `utility_bills`)
- `parse_recurring_bills_sheet.ts` — `Annual` → `recurring_bills`
- `parse_user_item_sheet.ts` — `Brian` / `Ariel` (Item/Amount/Date → `user_subscriptions`, skipping the "Total" row)
- `parse_food_sheet.ts` — `Food`'s two-block layout (Groceries in A–C, Takeaways in E–G)
- `parse_simple_actuals_sheet.ts` — `Transport` / `Clothing` (Date/Amount/Notes → `category_monthly_actuals`)
- `parse_rolling_sheet.ts` — special-cased, see below

Flags: `--dry-run` (counts only, no writes), `--truncate` (wipe target tables for repeatable dev runs), all in one transaction. Unknown sheet names are skipped with a warning, not an error, so future edits to the live xlsx don't break re-runs. `Non-PAYG Income Tax`, `House Stuff`, `FY25 Bonus` are explicitly skipped. The two `users` rows (matching sheet names "Brian"/"Ariel" by `full_name`) must exist before import (seed first); the command fails fast if it can't match a user. A small set of default `categories` (Groceries, Household, Utilities, Subscriptions, Fees, Transport, Clothing, Childcare) is seeded before import so parsers can tag records against them.

### Confirmed data quirks to handle explicitly

1. **Electricity/Gas/Water pre-baked averages**: some historical cells repeat a rolling-average value across several months (e.g. Electricity Nov/Dec 2022 both `167.1366667`) rather than a distinct real bill. Store exactly what's in the cell — no smoothing/correction.
2. **Missing/future months → no row**, not `amount: null` (schema is NOT NULL). Skip blank cells entirely; this also keeps `AVG()` rolling-average queries simple.
3. **`Annual` sheet's date columns**: confirmed by inspecting all 14 rows, "Day/Month" and "Year" are exactly what they're named (a recurring day/month pattern plus an optional year override — the year embedded in the "Day/Month" cell's underlying date is stale/arbitrary and is discarded, only its day+month are used), and "Next" is the one real, currently-correct date. Import maps: `due_day`/`due_month` ← day/month components of "Day/Month", `due_year` ← "Year" (null for all but one row in the source data), `next_due_on` ← "Next" directly. `frequency` defaults to `'annual'` for every row (the sheet has no frequency column — see point 7 for the one row known to need manual correction). `category_id` is left unset by the importer (best-effort name matching risks mis-tagging bills like "Manscaped" or "Nintendo"); the user categorizes each on first review.
4. **`Food`'s two-block layout**: columns A–C = Groceries, columns E–G (offset by blank D) = Takeaways — two separate `category_monthly_actuals` categories.
5. **`Amber` sheet is a cost breakdown, not a time series.** Its total ($440.3307692) matches the `Rolling` sheet's "Dog" budget line exactly — confirmed by direct comparison. Seed a category **"Dog"** with `budget_amount = 440.3307692`; actual monthly history for "Dog" comes from `Rolling`'s "Dog" note-rows instead (real varying actuals: $499.23, $347.70, $365.90, $391.30, $377.10 across Feb–Jun 2026) — Amber itself does not populate `category_monthly_actuals`.
6. **`Rolling` sheet supplies monthly data for everything without its own dedicated sheet.** It's a short (8-block, Feb→Sep 2026 — confirmed by cross-referencing Electricity/Groceries/Takeaway actuals against the `Electricity` and `Food` sheets, which match in most months), non-year-labeled window of budget-vs-actual lines keyed by a free-text `Note`. The importer:
   - **Skips notes already covered by a dedicated sheet** (Electricity Bill, Gas Bill, Water Bill, Groceries, Takeaway/Eating Out, Transport, Clothing, Dog) — confirmed these values match the dedicated sheets in most months (e.g. Electricity Bill Feb=$409.08 and Feb 2026 in the `Electricity` matrix are identical), so the dedicated sheet is treated as authoritative and Rolling's copy is dropped to avoid duplicates/conflicts.
   - **Skips notes matching an existing `recurring_bills.name`** — confirmed real data shows `Rolling` notes for **VPN, Contents Insurance, Bitwarden, Home Assistant, Strata Fees, Council Rates** exactly duplicate entries already in the `Annual` sheet (e.g. "Contents Insurance" $501.90 paid in July matches the Annual sheet's Contents Insurance row). Without this skip, the importer would spawn junk one-data-point categories shadowing the recurring bill tracker.
   - **Every remaining distinct `Note` is triaged into either `recurring_bills` or `category_monthly_actuals`**, using the rule: if the block's `Budget` value for that note stays flat/near-identical across all observed months, it's a fixed recurring payment → create a `recurring_bills` row (`frequency='monthly'`, `due_day` from the block's `DoM`, `amount` from the stable budget value). If the `Actual` value varies materially month to month, it's variable/logged spend → `findOrCreate` a category and insert a `category_monthly_actuals` row from the block's `Actual`, dated from the block's month. Confirmed concrete triage from the real data: **Kayo** ($45.99 flat), **Internet Bill** ($119 flat), **Health Insurance** (~$280 flat), **YouTube** ($25.99 flat), **Ariel Allowance** ($30 flat), **Brian Allowance** ($40 flat) → `recurring_bills`, tagged to a "Subscriptions" or "Fees" category. **Childcare** ($769.99–$1037.67), **Credit Card** ($0–$4137.05), **Apple Care** (one-off $329), **Strata Insurance** (one-off $693), **Stump removal** (one-off $500) → `category_monthly_actuals`, `findOrCreate`ing categories like "Childcare", "Credit Card", "Household".
   - The `Income` column values in each block (not row-aligned with the note rows — an independent short list within the same block) become `income_entries`, with `income_source_id`/`user_id` left null unless confidently matchable to a known source (best-effort, non-blocking).
   - Year resolution defaults to `--rolling-start-year=2026 --rolling-start-month=2`, overridable via flags, but the defaults are already correct for this import.
7. **Note for the user post-import**: `Strata Fees` shows as $640 twice in `Rolling` (Jul, and implicitly again later) against an annual total of $1280 in `Annual` — this looks like a biannual payment. The importer can't reliably infer payment frequency from one row, so `recurring_bills.frequency` defaults to `'annual'`; flag this specific one for the user to manually set to `'biannual'` after import.
8. **`Monthly` sheet is not imported** — it's a derived snapshot (income % splits against rolling averages), not raw historical data; it's superseded by the live `StandardMonthService` in Phase 5.

---

## 6. Docker / unRAID Deployment

**Dockerfile** (multi-stage): stage 1 builds the SvelteKit static bundle; stage 2 builds the AdonisJS app (`node ace build`) and installs production deps into the build output; stage 3 is a slim `node:20-alpine` runner that copies both build outputs, declares `VOLUME /app/data`, exposes port 3333, and runs `node ace migration:run --force && node bin/server.js` as its CMD. Running migrations in `CMD` (rather than a separate job) is a deliberate simplification appropriate for a single-tenant home deployment.

**docker-compose.yml**: single `bookkeeper` service, `/mnt/user/appdata/bookkeeper/data` mounted to `/app/data` (holds the SQLite file + `-wal`/`-shm`), env vars `APP_KEY` (generated once via `node ace generate:key`, kept in unRAID's `.env`, not baked into the image), `SESSION_DRIVER=cookie`, `DB_CONNECTION=sqlite`, `DB_FILENAME=/app/data/bookkeeper.sqlite3`. No reverse-proxy config in the app — user fronts it themselves for TLS (set `trustProxy` in Adonis config if session cookies need the `secure` flag behind TLS termination).

The mounted `data` directory is the **entire backup surface** — the whole financial history lives in one SQLite file. Worth calling out explicitly to the user: back it up by stopping the container (or using SQLite's `.backup` command) and copying that directory.

---

## 7. ESLint / Prettier

Single shared config at the monorepo root (only two packages — not worth duplicating): `eslint.config.mjs` (flat config, ESLint 9+) composing `typescript-eslint` strict-type-checked against both apps' tsconfigs, plus `eslint-plugin-svelte` scoped to `apps/web/src/**/*.svelte`. `.prettierrc.json` + `prettier-plugin-svelte`, with `eslint-config-prettier` disabling ESLint's stylistic rules so Prettier is the single formatting authority. Root `tsconfig.base.json` with `strict: true`. Root scripts: `lint`, `lint:fix`, `format`, `format:check`, `typecheck` (`tsc --noEmit` + `svelte-check`). No pre-commit hooks recommended — this is a 2-person household app, not a team codebase; `pnpm lint && pnpm typecheck` run manually (or in a simple CI workflow) is enough.

---

## 8. Phased Delivery Plan

Each phase is independently shippable/testable against the real unRAID deployment.

- **Phase 0 — Scaffolding + Auth**: monorepo init, both apps wired per §1, `users`/`categories` migrations + seeder (2 real users, default categories: Groceries, Household, Utilities, Subscriptions, Fees, Transport, Clothing, Childcare), full session auth (login → `/api/me` → layout guard), Dockerfile + compose proven on unRAID with an authenticated empty shell.
- **Phase 1 — Utility Bills**: `utilities` + `utility_bills` migrations, `UtilitiesController` + `UtilityBillsController` + `RollingAverageService`, `/utilities` pages (grid entry + trend/indicator), import Electricity/Gas/Water only (seeding their `utilities` rows tagged to the "Utilities" category), validated against production data. _The feature the user cares about most, done first._
- **Phase 2 — Recurring Bills Tracker**: `recurring_bills` migration (name, category_id, amount, frequency incl. custom interval, due_day/due_month/due_year, next_due_on), controller/pages with next-due sorting and "due soon" badges, import `Annual`.
- **Phase 3 — Personal Subscriptions**: `user_subscriptions` migration, per-user tabs + totals, import `Brian`/`Ariel`.
- **Phase 4 — Category Monthly Actuals**: `category_monthly_actuals` migration, `CategoriesController` CRUD + `CategoryActualsController`, `/categories` pages, import `Food` (two-block), `Transport`, `Clothing`, plus `Rolling`-derived data triaged per §5.6 into `recurring_bills` (Kayo, Internet Bill, Health Insurance, YouTube, Ariel/Brian Allowance) and `category_monthly_actuals` (Dog, Childcare, Credit Card, one-off costs) — with the recurring-bill skip-list applied — and `Amber` as the "Dog" category's `budget_amount` seed.
- **Phase 5 — Standard Month**: `income_sources`/`income_entries` migrations, `categories` alter (`budget_amount`, `include_in_standard_month`), `StandardMonthService` + controller, income controllers, `/month` page. _Full functional parity with the old `Rolling` + `Monthly` sheets._
- **Phase 6 — Polish**: dashboard home with summary tiles + trend charts (apply the `dataviz` skill when building these), CSV/JSON export, category color/reorder, mobile pass, documented SQLite backup procedure.

---

## Verification

- **Phase 0**: log into the running unRAID container as either seeded user; confirm session persists across refresh; confirm logout clears it.
- **Phase 1**: after import, spot-check known values against the source workbook — Electricity Feb 2026 = **$409.08**, Mar 2026 = **$314.86** (`Electricity` sheet); confirm the trend endpoint's 12-month average and up/down indicator look sane against these numbers.
- **Phase 2**: confirm imported recurring bills match source rows exactly, e.g. Costco Membership **$65.00**, `next_due_on` = **2026-01-31**; Council Rates **$2,689.30**, `next_due_on` = **2026-02-15**; flag `Strata Fees` for manual frequency correction per §5.7.
- **Phase 3**: confirm Brian's subscription total sums to **$38.47** and Ariel's to **$26.48** (matching the source sheets' own Total rows).
- **Phase 4**: run `import:xlsx --dry-run` first and check its summary/log for skipped Rolling notes (should list VPN/Contents Insurance/Bitwarden/Home Assistant/Strata Fees/Council Rates as skipped-as-recurring-bill, not created as categories) and the recurring-bill-vs-category triage results, before running for real; confirm no duplicate records were created for anything already in `recurring_bills`.
- **Phase 5**: pull up `/month` for a real past month (e.g. March 2026) and compare its projected vs. actual figures against the `Rolling`/`Monthly` sheets' own numbers for that month as a sanity check.
- Throughout: `pnpm lint`, `pnpm typecheck`, and `node ace test` (once tests exist) should pass before each phase is considered done.
