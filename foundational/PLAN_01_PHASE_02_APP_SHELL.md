# PLAN 01 · Phase 02 — App shell and navigation

Branch: `phase-02-app-shell`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

Replace the nine flat nav links, which collapse to a hamburger below `lg`, with a structure that matches what the app is for.

## Tasks

- [x] Run `/frontend-design` before starting.
- [x] Primary nav: Dashboard, Monthly, Income, Outgoings. Outgoings is a group holding Bills, Subscriptions, Expenses and Utilities.
- [x] Account menu (`DropdownMenu`): Categories, Tasks, Settings, Theme, Log out.
- [x] Mobile bottom tab bar: Dashboard, Monthly, Income, Outgoings, More. It replaces the hamburger panel.
- [x] Mount `<Toaster />` once in `+layout.svelte`.

## Acceptance criteria

- [x] `e2e/pages.spec.ts` is updated to the new structure, with zero console errors on every page.
- [x] Screenshots reviewed at 390px and 1440px, light and dark.
- [x] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

- **New `$lib/components/nav/` components**: `OutgoingsMenu.svelte` and `AccountMenu.svelte` each take a swappable `trigger` snippet (the same contract `ActionMenu`/`HelpTooltip` established in Phase 0), so the desktop top nav and `MobileTabBar.svelte` render the same two menus with different trigger chrome instead of duplicating link lists. See DESIGN.md's decisions log for the full rationale and a bits-ui gotcha found along the way (a `child` snippet drops the parent primitive's own `class` prop entirely - caught by a spec assertion, not inspection).
- **Retired `SettingsLink`, `ThemeToggleButton`, `LogoutButton`**: fully absorbed into `AccountMenu`'s dropdown content (Settings link, theme toggle item, Log out item) and deleted along with their specs - mirrors the `PrimaryButton`/`SecondaryButton` precedent from Phase 1.
- **Account menu trigger**: a circular avatar showing the user's `initials` on their `displayColor`, rather than a generic account icon - both fields already existed (used elsewhere for chart series/`SettingsLink`'s icon tint) and were simply unused for this purpose.
- **Mobile tab label**: the root route reads "Home" on the bottom tab bar but stays "Dashboard" on the desktop nav link - a five-column, ~78px-wide tab needed the shorter form; same route, different label per surface.
- **`e2e/pages.spec.ts`** now drives the Outgoings/Account dropdowns open before clicking a sub-link, split into `DIRECT_PAGES`/`OUTGOINGS_PAGES`/`ACCOUNT_PAGES` groups; the old standalone "settings page loads from the header link" test folded into the `ACCOUNT_PAGES` loop.
