# PLAN 01 · Phase 04 — Monthly and Income

Branch: `phase-04-monthly-income`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

Build the signature month strip. Break the two largest pages (about 1.5k and 1.9k lines) into section components on the shared primitives.

## Tasks

- [ ] Run `/frontend-design` and `dataviz` before starting.
- [ ] Build `MonthStrip.svelte` in `$lib/components/app/`, with its layout maths in a pure, unit-tested `$lib/month-strip.ts`: day → x, tick stacking, running balance.
- [ ] Feed the strip from `/standard-month`. Add any missing per-line due or pay dates in the API, with tests.
- [ ] The strip replaces Monthly's four summary cards. Cash on hand, actual net and variance go in a compact row beneath it.
- [ ] Split Monthly into `MonthSummary`, `OutgoingLinesTable`, `IncomingTable` and `CarryoverCard` under `$lib/components/monthly/`.
- [ ] Replace inline row editing with the sheet. Use `ActionMenu` for rows with more than two actions.
- [ ] Monthly's income rows use the shared `IncomeEntry*` components.
- [ ] Income:
  - [ ] Sources are edited in a sheet.
  - [ ] Entry rows use the shared components.
  - [ ] Filters use `ToggleGroup`.

## Acceptance criteria

- [ ] Each page is under about 500 lines. Behaviour is unchanged, and the existing specs are ported, not dropped.
- [ ] Screenshots reviewed at 390px and 1440px, light and dark.
- [ ] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

_None yet._
