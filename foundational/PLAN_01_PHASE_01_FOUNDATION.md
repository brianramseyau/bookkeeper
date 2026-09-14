# PLAN 01 · Phase 01 — Foundation: tokens, type, primitives

Branch: `phase-01-foundation`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md) and [DESIGN.md](DESIGN.md).

## Goal

Make the Polymer design real: tokens, type and a small set of app-level components. Every later phase then composes from these instead of hand-rolling Tailwind strings.

## Tasks

- [ ] Run `/frontend-design` before starting.
- [ ] Wire the Polymer tokens (light/dark) fully onto the shadcn variables and Tailwind colours.
- [ ] Recursive font: check that `@fontsource-variable/recursive` ships the CASL/MONO axes. If it doesn't, self-host the variable woff2 under `static/fonts`.
- [ ] Wire three type roles as utilities: `font-display`, the default sans, and `font-figures`.
- [ ] Build a dev-only `/_design` specimen route showing tokens, type roles, buttons, a list row, a sheet and a menu. It is removed in Phase 6.
- [ ] Screenshot `/_design` at 390px and 1440px, light and dark, then re-run `/frontend-design` against the screenshots. Run axe for contrast. Decide Recursive vs. Hanken Grotesk for the body role, and log it in DESIGN.md.
- [ ] Add shadcn components: `dialog`, `alert-dialog`, `sheet`, `drawer`, `sonner`, `tabs`, `input`, `label`, `select`, `badge`, `table`, `skeleton`, `separator`, `tooltip`, `toggle-group`.
- [ ] App components in `$lib/components/app/`, each with a spec:
  - [ ] `PageHeader`
  - [ ] `StatCard` / `StatGrid`
  - [ ] `ResponsiveFormSheet` (Sheet at `sm+`, Drawer below it)
  - [ ] `ConfirmDialog` plus `confirmDestructive()`
  - [ ] `EmptyState`
  - [ ] `LoadingSkeleton`
- [ ] Collapse `PrimaryButton` / `SecondaryButton` / `IconActionButton` into shadcn `Button` variants. Migrate the callers, then delete the old components.

## Acceptance criteria

- [ ] Tokens are used in both themes. No page uses raw indigo/slate class strings for primitives.
- [ ] Axe is clean on `/_design` in both themes.
- [ ] Screenshots reviewed; font decision logged in DESIGN.md.
- [ ] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

_None yet._
