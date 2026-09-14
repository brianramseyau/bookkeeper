# PLAN 01 · Phase 02 — App shell and navigation

Branch: `phase-02-app-shell`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

Replace the nine flat nav links, which collapse to a hamburger below `lg`, with a structure that matches what the app is for.

## Tasks

- [ ] Run `/frontend-design` before starting.
- [ ] Primary nav: Dashboard, Monthly, Income, Outgoings. Outgoings is a group holding Bills, Subscriptions, Expenses and Utilities.
- [ ] Account menu (`DropdownMenu`): Categories, Tasks, Settings, Theme, Log out.
- [ ] Mobile bottom tab bar: Dashboard, Monthly, Income, Outgoings, More. It replaces the hamburger panel.
- [ ] Mount `<Toaster />` once in `+layout.svelte`.

## Acceptance criteria

- [ ] `e2e/pages.spec.ts` is updated to the new structure, with zero console errors on every page.
- [ ] Screenshots reviewed at 390px and 1440px, light and dark.
- [ ] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

_None yet._
