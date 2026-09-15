# PLAN 01 · Phase 06 — Docs and cleanup

Branch: `phase-06-docs-cleanup`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Tasks

- [x] Retire `STYLEGUIDE.md`: move its still-true rules into `DESIGN.md`, and point AGENTS.md's UI section at DESIGN.md.
- [x] Remove the `/_design` specimen route.
- [x] Delete dead components and their specs.
- [x] Update the README's UI notes.

## Acceptance criteria

- [x] No references to STYLEGUIDE.md remain. No unused components remain.
- [x] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

- **What moved.** `DESIGN.md` gained a **Patterns** section carrying STYLEGUIDE's still-true, code-level conventions: chart mechanics, drag-and-drop reordering, the category tree (including the `<select>` string-value gotcha), responsive tables, placeholder rows, the `ActionMenu`/`HelpTooltip`/`IconActionButton` rules, form/spacing conventions, and loading/empty/error states. STYLEGUIDE's content that was already covered by DESIGN.md (concept/palette, type, card/radius, edit-in-a-sheet, interaction rules, shadcn ownership) was not duplicated, and its superseded pre-Polymer class strings and removed-component write-ups (`PrimaryButton`, `SecondaryButton`, `TextActionButton`, native `confirm()`, `/_design` references, indigo/slate recipes) were dropped rather than carried forward.
- **Dead components removed.** `LoadingIndicator`, `Sparkline`, `SuccessMessage` and `TrendIndicator` (each referenced only by its own spec) and their specs, plus the `/_design` route and its axe e2e spec (`e2e/design-specimen.spec.ts`). Every remaining `apps/web/src/lib/components/**/*.svelte` is imported by app code.
- **References.** "No references to STYLEGUIDE.md remain" is taken to mean living docs and code: `AGENTS.md`, `README.md`, code comments and the file itself are clean. The plan docs under `foundational/` (this file and `PLAN_01_OVERVIEW.md`) are left as the historical record of the work, so their mentions of the file remain.
- **README.** README had no dedicated UI-notes section, so the Stack section's Web bullet now names shadcn-svelte and points at `foundational/DESIGN.md`.
- **No screenshots for the docs/deletion work itself** — it removes a dev-only route and unused components and edits docs, so there is no user-facing UI of its own to capture. The e2e suite already loads every nav page with zero console errors. The mobile touch-target change shipped in the same PR *is* a user-facing UI change and was screenshot-reviewed at 390px (coarse pointer), light and dark, with menu rows measured at 44px.
- **Axe coverage moved, not dropped.** Deleting the `/_design` axe spec would have left axe automation with no consumer, so it now sweeps every main route (`e2e/axe.spec.ts`, both themes, whole page including the nav and bottom tab bar) - broader than the single specimen route it replaces. Running it against real pages caught a pre-Polymer contrast leftover in `MonthlyExpenseChart.svelte` (the "View as table" control and its table) plus four pre-existing app-wide issues: the `meta-viewport` `user-scalable=no`, colour-only inline prose links, the vendored `Tabs` inactive trigger contrast, and the account avatar's white initials on a mid-tone `displayColor` (now fixed via the new `$lib/color.ts` `readableTextColor`). All are migrated/fixed, so the sweep is green.
