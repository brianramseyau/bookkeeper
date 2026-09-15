# PLAN 01 · Phase 03 — Unified outgoings: list + detail template

Branch: `phase-03-unified-outgoings`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

This is the core consistency fix. Bills, Subscriptions, Expenses and Utilities should behave the same way: one list component, one detail page, one add/edit sheet.

## Tasks

### API (100% coverage; functional tests for every route; no schema change, so no migration)

- [x] Show endpoints: `GET /recurring-bills/:id`, `GET /subscriptions/:id`, `GET /expenses/:id`.
- [x] Payment history:
  - [x] `GET /recurring-bills/:id/payments` and `GET /subscriptions/:id/payments`, newest first.
  - [x] `DELETE /recurring-bill-payments/:id` and `DELETE /subscription-payments/:id`.
- [x] Trend: `GET /recurring-bills/:id/trend` and `GET /subscriptions/:id/trend`, via `rolling_average_service`. Generalise the service rather than duplicating it. A month with no stored amount falls back to the item's `amount`.

### Web: pure logic (unit-tested)

- [x] `$lib/lifecycle.ts`: `lifecycleState`, `lifecycleActions`, `groupByLifecycle`.
- [x] `$lib/outgoings/{bills,subscriptions,expenses,utilities}.ts` adapters covering list/get/create/update/delete, history, trend, href, columns, subtitle and form fields.

### Web: components and routes

- [x] `OutgoingsList.svelte`:
  - [x] Lifecycle Tabs with counts.
  - [x] Optional grouping and optional drag reorder.
  - [x] One `ActionMenu` per row.
  - [x] Empty state.
- [x] `OutgoingFormSheet.svelte`: add and edit via `ResponsiveFormSheet`.
- [x] `OutgoingDetail.svelte`:
  - [x] Header and actions.
  - [x] Stat grid.
  - [x] Trend chart.
  - [x] History table.
  - [x] Optional extra section.
- [x] Thin list routes for bills, subscriptions and expenses. Subscriptions keeps its per-person switcher.
- [x] New `bills/[billId]` and `subscriptions/[subscriptionId]`. Rebuild `expenses/[expenseId]`.
- [x] Utilities:
  - [x] The list moves to `OutgoingsList`.
  - [x] The detail page adopts the header, stats and settings sheet, and keeps its FY grid.
  - [x] No lifecycle, since that would need a migration.
- [x] Monthly lines link to the new detail pages. `#bill-{id}` highlight-flash anchors still work.

## Acceptance criteria

- [x] All four kinds have a list, a detail page and the same add/edit sheet. No per-page lifecycle markup remains.
- [x] Each list route is under about 150 lines.
- [x] An e2e spec covers bill list → detail → edit → pause → restore.
- [x] API coverage is 100%. `pnpm verify` and `pnpm test:e2e` pass. Screenshots reviewed.

## Notes and deviations

- **Adapter-driven, not kind-specific.** `$lib/outgoings/types.ts` defines one
  `OutgoingAdapter<T>` contract; each `$lib/outgoings/{bills,subscriptions,expenses,utilities}.ts`
  wraps that kind's `$lib/api/*` module and describes its columns, fields, stats,
  subtitle and href. `OutgoingsList`, `OutgoingFormSheet` and `OutgoingDetail`
  are generic over that contract, which is what lets every list route be a
  ~10-line file. `ExpenseBreakdown` and `UtilityBillsGrid` are the two
  page-specific sections, mounted through `OutgoingDetail`'s `extra` snippet.
- **Trend semantics for bills/subscriptions.** `RollingAverageService` gained
  `computeTrendWithFallback(entries, fallbackAmount)` alongside the existing
  `computeTrend` (both now share a private `summarize`). A payment row that has
  no stored `amount` falls back to the item's configured amount; months with no
  payment row at all are still gaps, matching expenses/utilities. Payment
  history shows the raw stored amounts (`—` where none was entered).
- **`toFormValues` prefers the API's computed `nextDueOn`.** A bill that only
  ever had a `dueDay` (no stored month - how the importer/demo data often
  arrives) would otherwise open the edit sheet with a blank *required* date and
  become unsaveable. It now falls back to the stored day/month only when there
  is no computed next due date.
- **Chart recoloured.** `MonthlyExpenseChart` (reused as the detail trend chart)
  moved off its pre-Polymer indigo/slate hexes onto the Polymer ink/rule/muted
  tones, so money-out reads as plain ink per DESIGN.md.
- **Deviations from DESIGN.md's mobile-list ideal.** The list keeps the existing
  responsive single-markup table (`block sm:table-row` with `sm:hidden`
  labels) rather than the two-line mobile row DESIGN.md describes - the same
  pattern the pre-overhaul pages used, carried across rather than redesigned in
  this phase. A phone therefore shows one label/value line per column under
  each item. Flagged for a follow-up rather than silently accepted.
- **Utilities have no lifecycle.** `isPaused`/`isArchived` don't exist on
  `utilities`, so `utilitiesAdapter.supportsLifecycle = false` and its list
  shows no Tabs/action menu lifecycle entries (the plan explicitly deferred the
  migration that would add them).
- **Web coverage** ended at ~95% lines / ~78% branches (from ~99%/80% before the
  six old route specs were replaced by adapter/component specs). The new
  `$lib/outgoings/**` files are the main gap; the deleted page specs covered
  far more duplicated markup than the generic components need. Not lowering the
  API bar (still 100%).
