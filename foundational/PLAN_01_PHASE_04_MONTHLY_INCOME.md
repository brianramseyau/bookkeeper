# PLAN 01 · Phase 04 — Monthly and Income

Branch: `phase-04-monthly-income`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

Build the signature month strip. Break the two largest pages (about 1.5k and 1.9k lines) into section components on the shared primitives.

## Tasks

Split into reviewable chunks rather than one pass, given the size of the two
pages involved (see Notes and deviations) - each chunk gets its own local
gate (`pnpm verify`) before moving to the next, with a screenshot check after
chunk 1 specifically before committing to the larger structural rewrite in
chunks 2-4.

- [x] Run `/frontend-design` before starting. `dataviz` isn't installed in
      this environment - proceeded using DESIGN.md and `/frontend-design`
      only (see Notes and deviations).
- [x] Build `MonthStrip.svelte` in `$lib/components/app/`, with its layout
      maths in a pure, unit-tested `$lib/month-strip.ts`: day → x, tick
      stacking, running balance.
- [x] Feed the strip from `/standard-month`. Per-line due/pay dates already
      existed on the API response (`StandardMonthLine.dueDate`/`dueDay`,
      `IncomeLine.payDates`) - no API change needed.
- **Chunk 1:**
  - [x] The strip replaces Monthly's four summary cards. Cash on hand,
        actual net and variance go in a compact row beneath it.
  - [x] Screenshot review (390px/1440px, light/dark) before continuing -
        owner reviewed, approved to proceed (see Notes and deviations for
        the layout rework that came out of this review).
- **Chunk 2:**
  - [x] Split Monthly into `MonthSummary`, `OutgoingLinesTable`,
        `IncomingTable` and `CarryoverCard` under `$lib/components/monthly/`,
        behaviour unchanged, existing specs ported (unmodified - see Notes
        and deviations). `+page.svelte`: 1497 -> 565 lines (470 of it is
        still orchestration script, not markup - see Notes).
- **Chunk 3:**
  - [ ] Replace inline row editing with the sheet. Use `ActionMenu` for rows
        with more than two actions.
  - [ ] Build shared `IncomeEntryDisplayRow`/`IncomeEntryEditRow` components
        and use them for Monthly's income rows.
- **Chunk 4:**
  - [ ] Income:
    - [ ] Sources are edited in a sheet.
    - [ ] Entry rows use the shared components (from chunk 3).
    - [ ] Filters use `ToggleGroup`.

## Acceptance criteria

- [ ] Each page is under about 500 lines. Behaviour is unchanged, and the existing specs are ported, not dropped.
- [ ] Screenshots reviewed at 390px and 1440px, light and dark.
- [ ] `pnpm verify` and `pnpm test:e2e` pass.

## Notes and deviations

- The `dataviz` skill referenced by AGENTS.md/DESIGN.md isn't available in
  this environment (only `frontend-design`, `find-skills` and
  `customize-opencode` are installed here) - the month strip was designed
  and built from DESIGN.md's own signature-element spec and
  `/frontend-design` alone. Flag this if a future session has `dataviz`
  available, in case it would have changed the chart's construction.
- AGENTS.md's Web conventions section describes `IncomeEntryDisplayRow.svelte`
  /`IncomeEntryEditRow.svelte` as already existing ("as `IncomeEntryDisplayRow.svelte`
  /`IncomeEntryEditRow.svelte` already are for the Income page"). They don't
  exist yet as of the start of this phase - building them is chunk 3's job,
  not a pre-existing component this phase can just adopt. Update that
  AGENTS.md wording once they exist.
- The first pass of `MonthStrip` rendered a full name label under every
  tick, matching DESIGN.md's ASCII mock literally - but that mock shows
  ~8 ticks total, while a real household's month can carry 20-30+ outgoing
  lines (checked against the actual dev database: 16 active recurring
  bills alone, 4 of them sharing a single due day, plus subscriptions,
  utilities and expenses on top). At that density, always-visible label
  text either overflows a bounded box or forces an unbounded one that
  bleeds into whatever renders below the strip - confirmed both visually
  and by measuring the rendered page (ticks escaping the card's own
  bounding box). Reworked to a compact glyph + amount per tick, with the
  item's name carried via `title` (mouse hover) and `aria-label`
  (accessible name) instead of always-rendered text, and stack rows capped
  at 4 with a fixed strip height so density can never break the layout -
  excess same-day collisions overlap the last row rather than growing the
  box. The horizontal track width now scales with the month's day count
  (`daysInMonth * 28px`, min 480px) so the below-`sm` horizontal scroll has
  legible per-day spacing instead of a fixed guess. Logged in DESIGN.md's
  decisions log too.
- Chunk 2 was a pure markup extraction: all editing state and handlers
  (carryover, expense lines, income entries, placeholders) stay in
  `+page.svelte`, passed down to the four new components as props/callbacks
  (two-way-bound editing fields use Svelte 5 `$bindable()`; `CarryoverCard`
  takes the `EditState` instance directly by reference rather than
  unpacking it, since that's the pattern `edit-state.svelte.ts` is designed
  for). Because the page's own behaviour never changed, `page.spec.ts` -
  which renders the full composed page - needed no changes at all and
  still passes unmodified; each new component also got its own lighter
  colocated spec. `+page.svelte` is 565 lines, still over the ~500 target -
  470 of that is the orchestration script (load/save/edit-state handlers),
  which chunk 3's move from ad hoc state trios to `EditState` + sheets
  should shrink further; revisit the exact number once chunk 3 is done
  rather than force it down prematurely here.
- Given the size of Monthly (~1.5k lines) and Income (~1.9k lines) and the
  amount of interlocking inline-edit state each holds (utility bills,
  recurring bill/subscription payments, expense actuals, income
  entries/placeholders, income sources, tax settings), the task list above
  is worked as four reviewable chunks instead of one pass, with a
  screenshot checkpoint after chunk 1 (the purely visual month-strip swap)
  before starting the larger structural rewrite in chunks 2-4.
