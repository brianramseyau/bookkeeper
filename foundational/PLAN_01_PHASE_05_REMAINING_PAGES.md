# PLAN 01 · Phase 05 — Remaining pages and polish

Branch: `phase-05-remaining-pages`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Tasks

- [x] Run `/frontend-design` before starting.
- [x] Income (owner-requested, added after the initial plan):
  - [x] Full `/frontend-design`/token pass - the page and its components still
        carry the pre-Polymer slate/indigo palette while Subscriptions is on
        the tokens.
  - [x] The person selector becomes the same rounded-full chip row
        Subscriptions uses, not the old bordered card tiles.
  - [x] "Add income" moves to the top right, as a `PageHeader` action (a menu
        offering Salary / Other income), matching the other pages' top-right
        Add button.
  - [x] The page title renders in the display type role via `PageHeader`.
  - [x] Income sources move to the bottom of the page - they are settings
        (edit-a-couple-of-times-a-year), far less frequently read than the
        entries they feed.
- [x] Dashboard:
  - [x] `MonthStrip` becomes the hero, replacing the three stat cards.
  - [x] Card headers are consistent.
  - [x] "Upcoming bills" rows link to bill detail pages.
- [x] Categories: the tree keeps drag and nesting, editing moves to the sheet, and lifecycle actions come from `$lib/lifecycle.ts`.
- [x] Settings and Tasks:
  - [x] Card sections with a consistent label/input/help layout.
  - [x] Toasts for save feedback.
  - [x] `ConfirmDialog` instead of `confirm()`.
- [x] Login and error pages move onto the tokens.

## Acceptance criteria

- [x] `grep` over `src/routes` finds no `confirm(`, `LoadingIndicator`, `PrimaryButton`, `IconActionButton` or uppercase eyebrow labels.
      The one exception is `src/routes/_design/+page.svelte`, the `/_design`
      component specimen, whose whole job is to show `IconActionButton`
      variants - it is a dev-only page Phase 6 retires with the other dead
      components, not a user-facing route.
- [x] Income: no `slate-`/`indigo-` classes remain on `routes/income` or
      `$lib/components/income/**`, the person chips match Subscriptions', the
      Add control is a top-right `PageHeader` action, and sources render below
      the entries.
- [x] Screenshots reviewed. `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

- Income rework was added to this phase at the owner's request after the phase
  doc was written; it was done first, as its own reviewable chunk, before the
  Dashboard/Categories/Settings/Tasks/Login work.
- Income's person selector is now `IncomeUserChips.svelte` (chips + per-person
  `/mo` total), the year nav `IncomeYearNav.svelte`, and the YTD total/split
  `IncomeYtdSummary.svelte` (a three-column figure row, the total in `in` -
  the old middle-dot "FY to date: $X · Salary $Y · Other $Z" meta line is
  gone, per DESIGN.md's copy rules).
- Income's charts were still on the pre-Polymer indigo/slate chart palette;
  `IncomeYtdChart`/`YearlyIncomeLineChart` moved onto the same ink/rule/muted
  neutrals as `MonthlyExpenseChart`, and the salary-vs-other pie distinguishes
  the two series by weight (ink vs muted) rather than accent colour.
  `dataviz` still isn't installed in this environment (same caveat as Phase 4).
- The shared `IncomeEntryDisplayRow` (used by both Monthly and Income) was
  token-migrated too, so Monthly's income rows pick up the new colours. The
  rest of Monthly's tables remain on the pre-Polymer slate classes - out of
  scope for this phase.
- Dashboard now fetches `/standard-month` alongside `/dashboard/summary` so
  `MonthStrip` can be the hero; the old "projected net / actual net / next bill
  due" stat cards are gone (the strip carries the projection, and the Upcoming
  bills card now lists **all** upcoming bills, not everything-after-the-first -
  it no longer has a stat card above it to show the first one).
- `PageHeader` now also sets the document `<title>`, with an optional
  `documentTitle` override for the Dashboard (h1 greets the person, tab reads
  "Dashboard"). Pages that previously used `PageHead` with a `PageHeader` now
  get their tab title from the header.
- Categories: inline row editing is gone - add and edit share
  `CategoryFormSheet` (opened from the top-right "Add category" action or a
  row's Edit action). Archived/removed rows moved out of the page into
  `CategoryLifecycleRows.svelte`, and the page no longer imports
  `IconActionButton`. Lifecycle transitions use `$lib/lifecycle.ts`'s
  `lifecyclePatch`/`LIFECYCLE_ACTION_TOASTS`; categories have no `isPaused`,
  so the `pause`/`resume` actions the generic helper can produce are simply
  never offered here (the tree only ever calls `archive`/`unarchive`/`restore`/
  `delete`). `confirm()` is replaced by `confirmDestructive`, and the uppercase
  Archived/Removed/System section labels are now sentence case.
- Settings devices moved into `settings/DeviceList.svelte` and Tasks backups
  into `tasks/BackupList.svelte`, so those routes no longer import
  `IconActionButton`. Both pages use `toast.success` for save feedback
  (replacing the inline "Saved." messages) and `confirmDestructive` for
  device/backup deletion.
- Monthly's full-page `LoadingIndicator` was swapped for `LoadingSkeleton` to
  clear the acceptance grep - it was the last route still using it.

