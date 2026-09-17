# PLAN 02 · Phase 01 — Monthly unified list

Branch: `claude/triangle-graph-mobile-k6dy7g` (see [PLAN_02_OVERVIEW.md](PLAN_02_OVERVIEW.md) - session branch, not `phase-02-...`). See [PLAN_02_OVERVIEW.md](PLAN_02_OVERVIEW.md) for how this was arrived at (three rounds of Artifact prototyping with the owner) and what's explicitly out of scope (Dashboard's own `MonthStrip`).

## Goal

Replace Monthly's `<MonthStrip>` + `OutgoingLinesTable` + `IncomingTable` with one chronological, touch-friendly list, reusing every existing mutation path unchanged.

## Tasks

- [x] Run `/frontend-design` before starting.
- [x] Build a pure, unit-tested `$lib` helper (e.g. `monthly-unified-list.ts`) that merges `sortedExpenseLines`' outgoing lines with `incomeRowsForLine`'s rows across every income line (both `actual` and `placeholder`) into one array ordered by resolved date:
  - Outgoing: `resolveDueDate(line, year, month)`.
  - Income `actual` row: `row.entry.receivedOn` (nullable).
  - Income `placeholder` row: `row.date`.
  - Lines/rows with no resolvable date keep `sortedExpenseLines`' existing tie-break (undated last, stable order otherwise) rather than inventing a new rule.
- [x] Build `MonthlyUnifiedList.svelte` under `$lib/components/monthly/`, rendering the merged array as a single scrolling list on Polymer tokens (the current `OutgoingLinesTable`/`IncomingTable`/`CarryoverCard` are still on pre-Polymer `slate-`/`indigo-` classes - migrate as part of this rebuild, not a follow-up):
  - **Bill rows:** a ≥44px Paid checkbox hit target (`onTogglePaid`, `canTrackPaid`/`paidTooltip` unchanged) and an edit pencil (`onStartEdit`) opening the existing `OutgoingLineEditSheet`, shown only when `editable`. Due/paid/estimated status via `dueLabel`/`dueChipClass`/`actualIsAssumed` (unchanged helpers), not colour alone.
  - **Logged income rows:** reuse `IncomeEntryDisplayRow` (or a props-compatible slim variant) for edit (`onEditEntry`)/delete (`onDeleteEntry`).
  - **Placeholder income rows:** Accept (`onAcceptPlaceholder`) + Edit (`onEditPlaceholder`) at ≥44px, keeping DESIGN.md's existing italic/muted placeholder-row treatment.
  - A "Today" divider; the list scrolls to it on mount (prototype behaviour), respecting `prefers-reduced-motion`.
  - Every row keeps its line/entry's existing `key` for Svelte's keyed `{#each}`, matching current tables.
- [x] Rework `MonthSummary.svelte` for Monthly: drop `<MonthStrip>`, keep (or reshape) a compact stat row - decide during implementation whether that's the existing Cash on hand/Actual net/Variance trio, an Income/Outgoing/Net trio, or both, against DESIGN.md's `StatGrid`/`StatCard`. Dashboard's own `<MonthStrip>` call in `routes/+page.svelte` is untouched.
- [x] Keep `CarryoverCard`'s edit behaviour (`startEditCarryover`/`saveCarryover`, unchanged); restyle it as a compact header row rather than a full-width table, on Polymer tokens.
- [x] Wire `routes/monthly/+page.svelte` to the new component(s) in place of `MonthSummary`'s old strip layout, `OutgoingLinesTable` and `IncomingTable`. All handlers (`togglePaid`, `openEditExpense`/`saveExpenseEditValues`/`removeExpenseActual`, `openEditEntry`/`openEditPlaceholder`/`saveEntryEditValues`/`acceptPlaceholder`/`handleDeleteEntry`, `startEditCarryover`/`saveCarryover`, `openLogIncome`/`handleLogEntry`) stay as-is; only what renders them changes.
- [x] Delete `OutgoingLinesTable.svelte` and `IncomingTable.svelte` and their specs once `grep` confirms nothing else imports them (they're Monthly-only today).
- [x] Port every existing spec: `page.spec.ts` (updated for the new markup, behaviour unchanged), plus the deleted components' coverage folded into new specs for `monthly-unified-list.ts` and `MonthlyUnifiedList.svelte`.
- [x] Check `e2e/` for specs asserting on the removed tables' markup (e.g. nav-page-loads-with-no-console-errors style checks) and adjust if needed.
- [x] Screenshot review (390px/1440px, light/dark, en-AU) against DESIGN.md before committing.
- [x] Update DESIGN.md: retire (or narrow to Dashboard-only) the "Signature element: the month strip" section, and log the ≥44px inline-touch-target deviation in the decisions log.

## Acceptance criteria

- [x] Monthly's Outgoing and Incoming sections are replaced by one chronological list; no horizontal-scrolling element remains on the page.
- [x] Every existing mutation (toggle paid, edit an outgoing actual, accept/edit/delete an income entry, log income, edit carryover) still works, unchanged in behaviour, from the new list.
- [x] Checkbox, pencil, and Accept/Edit tap targets are ≥44px with visible pressed states.
- [x] `pnpm verify` and `pnpm test:e2e` pass; API coverage unaffected (web-only phase, no API changes expected).
- [x] Screenshots reviewed at 390px and 1440px, light and dark.
- [x] DESIGN.md's decisions log updated.

## Notes and deviations

- **No footer totals.** The old `OutgoingLinesTable`/`IncomingTable` each had a Projected/Actual footer row. A single interleaved chronological list has no natural place for two separate subtotals side by side, so these were dropped; the stat strip above already carries the month's aggregate figures. Logged in DESIGN.md's new "Monthly's unified list" pattern section.
- **Row layout corrected against the owner's Artifact prototype.** The first pass put the Paid checkbox/edit pencil trailing (mirroring the old table's rightmost columns). The owner's screenshot review flagged this as not matching the approved prototype, which leads every row with a 44px icon (checkbox, a static check for a logged income entry, or a blank spacer for a placeholder) before the label, then the amount, then trailing action(s) - corrected to match, and `MonthSummary`'s stat row switched from the three `StatCard`s (Cash on hand/Actual net/Variance) to the prototype's compact Income/Outgoing/Net strip. See DESIGN.md's decisions log and "Monthly's unified list" pattern section.
- **Header actions matched to the prototype in the same review pass.** `MonthNavHeader` gained a `compact` variant (chevron icon buttons flanking a full "Month Year" `<h2>`, plus a small "This Month" link) - opt-in via a new `variant` prop so the Dashboard's existing `MonthNavHeader` (text "← Prev"/"Next →" buttons, short "Mon Year" label) is untouched. It renders as its own centered, full-width row under the page header (a 3-column CSS grid so the "This Month" link never throws the centered month label off-center), matching the prototype's two-row topbar - not squeezed into `PageHeader`'s inline actions slot next to the title, which is where the first pass put it. Monthly's page heading now lives in this compact nav rather than a separate `MonthSummary` headline (removed, to avoid showing the month twice). "Log income" moved from a labelled button next to a "Manage income sources" text link to a single discreet `+` `IconActionButton` in the page header (per the owner - the income sources link was redundant with the account/nav menu). `MonthSummary`'s stat strip labels changed to match the prototype exactly too: "Net" (not "Net (so far)"), with an explicit `+` sign on a non-negative value (`formatCurrency` alone never prints one) - and each stat cell got `min-w-0`/`truncate` after the `+` sign's extra width pushed the rightmost ("Net") figure past the card edge at 390px, clipping digits instead of wrapping. There is no "Add expense" action behind the `+` yet (the prototype's Add menu shows one, but Monthly has no quick-add-expense flow to wire it to) - logged as a gap for a future pass rather than built out here, since it's outside this phase's task list.
- **Income lines with nothing dated now render nothing.** The old `IncomingTable` always rendered one summary `<tr>` per income line (its own projected/actual, including the "(est.)" flag) even when that line had no pay dates and no logged entries this month. The unified list only ever renders `incomeRowsForLine`'s rows (as the phase's own task list specified), so a line in that state has nothing to place in the chronological feed - its totals still count toward `data.income.actualTotal`/`projectedTotal` and the stat row, just not as a dated row. Covered by a page test and logged in DESIGN.md.
- **`CarryoverCard`** became a single compact header row (label, amount, pencil - or the amount input plus Save/Cancel while editing) instead of a full-width mini-table, per the task list; behaviour (`EditState`, `onStartEdit`/`onSave`) is unchanged.
- **Not part of this phase** (unchanged, per PLAN_02_OVERVIEW.md's scope): the Dashboard's own `MonthStrip`.
