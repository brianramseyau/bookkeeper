# PLAN 01 · Phase 01 — Foundation: tokens, type, primitives

Branch: `phase-01-foundation`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md) and [DESIGN.md](DESIGN.md).

## Goal

Make the Polymer design real: tokens, type and a small set of app-level components. Every later phase then composes from these instead of hand-rolling Tailwind strings.

## Tasks

- [x] Run `/frontend-design` before starting.
- [x] Wire the Polymer tokens (light/dark) fully onto the shadcn variables and Tailwind colours.
- [x] Recursive font: check that `@fontsource-variable/recursive` ships the CASL/MONO axes. If it doesn't, self-host the variable woff2 under `static/fonts`.
- [x] Wire three type roles as utilities: `font-display`, the default sans, and `font-figures`.
- [x] Build a dev-only `/_design` specimen route showing tokens, type roles, buttons, a list row, a sheet and a menu. It is removed in Phase 6.
- [x] Screenshot `/_design` at 390px and 1440px, light and dark, then re-run `/frontend-design` against the screenshots. Run axe for contrast. Decide Recursive vs. Hanken Grotesk for the body role, and log it in DESIGN.md.
- [x] Add shadcn components: `dialog`, `alert-dialog`, `sheet`, `drawer`, `sonner`, `tabs`, `input`, `label`, `select`, `badge`, `table`, `skeleton`, `separator`, `tooltip`, `toggle-group`.
- [x] App components in `$lib/components/app/`, each with a spec:
  - [x] `PageHeader`
  - [x] `StatCard` / `StatGrid`
  - [x] `ResponsiveFormSheet` (Sheet at `sm+`, Drawer below it)
  - [x] `ConfirmDialog` plus `confirmDestructive()`
  - [x] `EmptyState`
  - [x] `LoadingSkeleton`
- [x] Collapse `PrimaryButton` / `SecondaryButton` / `IconActionButton` into shadcn `Button` variants. Migrate the callers, then delete the old components.

## Acceptance criteria

- [x] Tokens are used in both themes. No page uses raw indigo/slate class strings for primitives (except the nav bar in `+layout.svelte`, deliberately deferred to Phase 2's App Shell work).
- [x] Axe is clean on `/_design` in both themes.
- [x] Screenshots reviewed; font decision logged in DESIGN.md.
- [x] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

- **`PrimaryButton`/`SecondaryButton` fully deleted.** All 27 call sites across 14 files migrated to shadcn `Button` (`variant="outline"` for the old Secondary), then both components and their specs removed.
- **`IconActionButton` kept, not deleted.** Rebuilt internally as a thin wrapper around shadcn `Button` (`variant="ghost" size="icon"`), but kept as its own component with its existing public API (`onclick`/`onmousedown`/`disabled`/`variant`/`label`/`path`/`class`) rather than migrating its ~147 call sites to raw `Button` usage. Those call sites live mostly in pages slated for rewrite in Phases 3–4 (the unified outgoings list/detail template and Monthly/Income); migrating them now would be thrown away shortly after. Its `neutral`/`cancel`/`muted` variants hover to `text-foreground`, not `text-primary` — see DESIGN.md's decisions log.
- **Recursive confirmed for both type roles** — no fallback to Hanken Grotesk was needed. See DESIGN.md's decisions log for the specimen-page check.
- **Contrast needed two rounds**, not one: the initial light/dark hexes (checked as plain text against `ground`) passed, but axe against the real rendered `/_design` badges caught that a colour's own tint background is a stricter, separate test — light `due` and dark `over`'s tint both needed adjustment, and separately shadcn's own generated `destructive` Button/Badge variants needed `--over` darkened again (`#BE3A27` → `#9C3320`), since they use Tailwind's opacity-modifier syntax rather than our `color-mix` tint variables. Full story in DESIGN.md's decisions log.
- **`+layout.svelte`'s root wrapper** (loading state and the `min-h-screen` main div) moved onto `bg-background`/`text-muted-foreground` — found via an axe report during the contrast work. The nav bar itself keeps its slate/indigo classes; that's Phase 2's job.
- **`Sonner`/`mode-watcher`** were added as shadcn dependencies but `<Toaster>` isn't mounted anywhere yet — Phase 2 mounts it and must override bits-ui's `mode-watcher`-driven theme prop with the app's own `themeState.current`. See DESIGN.md's decisions log.
