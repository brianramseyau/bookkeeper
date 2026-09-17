# PLAN 02 · Phase 01 — Monthly unified list

Branch: `claude/triangle-graph-mobile-k6dy7g` (see [PLAN_02_OVERVIEW.md](PLAN_02_OVERVIEW.md) - session branch, not `phase-02-...`). See [PLAN_02_OVERVIEW.md](PLAN_02_OVERVIEW.md) for how this was arrived at (three rounds of Artifact prototyping with the owner) and what's explicitly out of scope (Dashboard's own `MonthStrip`).

## Goal

Replace Monthly's `<MonthStrip>` + `OutgoingLinesTable` + `IncomingTable` with one chronological, touch-friendly list, reusing every existing mutation path unchanged.

## Tasks

- [ ] Run `/frontend-design` before starting.
- [ ] Build a pure, unit-tested `$lib` helper (e.g. `monthly-unified-list.ts`) that merges `sortedExpenseLines`' outgoing lines with `incomeRowsForLine`'s rows across every income line (both `actual` and `placeholder`) into one array ordered by resolved date:
  - Outgoing: `resolveDueDate(line, year, month)`.
  - Income `actual` row: `row.entry.receivedOn` (nullable).
  - Income `placeholder` row: `row.date`.
  - Lines/rows with no resolvable date keep `sortedExpenseLines`' existing tie-break (undated last, stable order otherwise) rather than inventing a new rule.
- [ ] Build `MonthlyUnifiedList.svelte` under `$lib/components/monthly/`, rendering the merged array as a single scrolling list on Polymer tokens (the current `OutgoingLinesTable`/`IncomingTable`/`CarryoverCard` are still on pre-Polymer `slate-`/`indigo-` classes - migrate as part of this rebuild, not a follow-up):
  - **Bill rows:** a ≥44px Paid checkbox hit target (`onTogglePaid`, `canTrackPaid`/`paidTooltip` unchanged) and an edit pencil (`onStartEdit`) opening the existing `OutgoingLineEditSheet`, shown only when `editable`. Due/paid/estimated status via `dueLabel`/`dueChipClass`/`actualIsAssumed` (unchanged helpers), not colour alone.
  - **Logged income rows:** reuse `IncomeEntryDisplayRow` (or a props-compatible slim variant) for edit (`onEditEntry`)/delete (`onDeleteEntry`).
  - **Placeholder income rows:** Accept (`onAcceptPlaceholder`) + Edit (`onEditPlaceholder`) at ≥44px, keeping DESIGN.md's existing italic/muted placeholder-row treatment.
  - A "Today" divider; the list scrolls to it on mount (prototype behaviour), respecting `prefers-reduced-motion`.
  - Every row keeps its line/entry's existing `key` for Svelte's keyed `{#each}`, matching current tables.
- [ ] Rework `MonthSummary.svelte` for Monthly: drop `<MonthStrip>`, keep (or reshape) a compact stat row - decide during implementation whether that's the existing Cash on hand/Actual net/Variance trio, an Income/Outgoing/Net trio, or both, against DESIGN.md's `StatGrid`/`StatCard`. Dashboard's own `<MonthStrip>` call in `routes/+page.svelte` is untouched.
- [ ] Keep `CarryoverCard`'s edit behaviour (`startEditCarryover`/`saveCarryover`, unchanged); restyle it as a compact header row rather than a full-width table, on Polymer tokens.
- [ ] Wire `routes/monthly/+page.svelte` to the new component(s) in place of `MonthSummary`'s old strip layout, `OutgoingLinesTable` and `IncomingTable`. All handlers (`togglePaid`, `openEditExpense`/`saveExpenseEditValues`/`removeExpenseActual`, `openEditEntry`/`openEditPlaceholder`/`saveEntryEditValues`/`acceptPlaceholder`/`handleDeleteEntry`, `startEditCarryover`/`saveCarryover`, `openLogIncome`/`handleLogEntry`) stay as-is; only what renders them changes.
- [ ] Delete `OutgoingLinesTable.svelte` and `IncomingTable.svelte` and their specs once `grep` confirms nothing else imports them (they're Monthly-only today).
- [ ] Port every existing spec: `page.spec.ts` (updated for the new markup, behaviour unchanged), plus the deleted components' coverage folded into new specs for `monthly-unified-list.ts` and `MonthlyUnifiedList.svelte`.
- [ ] Check `e2e/` for specs asserting on the removed tables' markup (e.g. nav-page-loads-with-no-console-errors style checks) and adjust if needed.
- [ ] Screenshot review (390px/1440px, light/dark, en-AU) against DESIGN.md before committing.
- [ ] Update DESIGN.md: retire (or narrow to Dashboard-only) the "Signature element: the month strip" section, and log the ≥44px inline-touch-target deviation in the decisions log.

## Acceptance criteria

- [ ] Monthly's Outgoing and Incoming sections are replaced by one chronological list; no horizontal-scrolling element remains on the page.
- [ ] Every existing mutation (toggle paid, edit an outgoing actual, accept/edit/delete an income entry, log income, edit carryover) still works, unchanged in behaviour, from the new list.
- [ ] Checkbox, pencil, and Accept/Edit tap targets are ≥44px with visible pressed states.
- [ ] `pnpm verify` and `pnpm test:e2e` pass; API coverage unaffected (web-only phase, no API changes expected).
- [ ] Screenshots reviewed at 390px and 1440px, light and dark.
- [ ] DESIGN.md's decisions log updated.

## Notes and deviations

_(filled in once the phase is implemented)_
