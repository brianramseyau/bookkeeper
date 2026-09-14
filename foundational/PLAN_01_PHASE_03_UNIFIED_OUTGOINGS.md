# PLAN 01 · Phase 03 — Unified outgoings: list + detail template

Branch: `phase-03-unified-outgoings`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

This is the core consistency fix. Bills, Subscriptions, Expenses and Utilities should behave the same way: one list component, one detail page, one add/edit sheet.

## Tasks

### API (100% coverage; functional tests for every route; no schema change, so no migration)

- [ ] Show endpoints: `GET /recurring-bills/:id`, `GET /subscriptions/:id`, `GET /expenses/:id`.
- [ ] Payment history:
  - [ ] `GET /recurring-bills/:id/payments` and `GET /subscriptions/:id/payments`, newest first.
  - [ ] `DELETE /recurring-bill-payments/:id` and `DELETE /subscription-payments/:id`.
- [ ] Trend: `GET /recurring-bills/:id/trend` and `GET /subscriptions/:id/trend`, via `rolling_average_service`. Generalise the service rather than duplicating it. A month with no stored amount falls back to the item's `amount`.

### Web: pure logic (unit-tested)

- [ ] `$lib/lifecycle.ts`: `lifecycleState`, `lifecycleActions`, `groupByLifecycle`.
- [ ] `$lib/outgoings/{bills,subscriptions,expenses,utilities}.ts` adapters covering list/get/create/update/delete, history, trend, href, columns, subtitle and form fields.

### Web: components and routes

- [ ] `OutgoingsList.svelte`:
  - [ ] Lifecycle Tabs with counts.
  - [ ] Optional grouping and optional drag reorder.
  - [ ] One `ActionMenu` per row.
  - [ ] Empty state.
- [ ] `OutgoingFormSheet.svelte`: add and edit via `ResponsiveFormSheet`.
- [ ] `OutgoingDetail.svelte`:
  - [ ] Header and actions.
  - [ ] Stat grid.
  - [ ] Trend chart.
  - [ ] History table.
  - [ ] Optional extra section.
- [ ] Thin list routes for bills, subscriptions and expenses. Subscriptions keeps its per-person switcher.
- [ ] New `bills/[billId]` and `subscriptions/[subscriptionId]`. Rebuild `expenses/[expenseId]`.
- [ ] Utilities:
  - [ ] The list moves to `OutgoingsList`.
  - [ ] The detail page adopts the header, stats and settings sheet, and keeps its FY grid.
  - [ ] No lifecycle, since that would need a migration.
- [ ] Monthly lines link to the new detail pages. `#bill-{id}` highlight-flash anchors still work.

## Acceptance criteria

- [ ] All four kinds have a list, a detail page and the same add/edit sheet. No per-page lifecycle markup remains.
- [ ] Each list route is under about 150 lines.
- [ ] An e2e spec covers bill list → detail → edit → pause → restore.
- [ ] API coverage is 100%. `pnpm verify` and `pnpm test:e2e` pass. Screenshots reviewed.

## Notes and deviations

_None yet._
