# PLAN 01 · Phase 05 — Remaining pages and polish

Branch: `phase-05-remaining-pages`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Tasks

- [ ] Run `/frontend-design` before starting.
- [ ] Dashboard:
  - [ ] `MonthStrip` becomes the hero, replacing the three stat cards.
  - [ ] Card headers are consistent.
  - [ ] "Upcoming bills" rows link to bill detail pages.
- [ ] Categories: the tree keeps drag and nesting, editing moves to the sheet, and lifecycle actions come from `$lib/lifecycle.ts`.
- [ ] Settings and Tasks:
  - [ ] Card sections with a consistent label/input/help layout.
  - [ ] Toasts for save feedback.
  - [ ] `ConfirmDialog` instead of `confirm()`.
- [ ] Login and error pages move onto the tokens.

## Acceptance criteria

- [ ] `grep` over `src/routes` finds no `confirm(`, `LoadingIndicator`, `PrimaryButton`, `IconActionButton` or uppercase eyebrow labels.
- [ ] Screenshots reviewed. `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

_None yet._
