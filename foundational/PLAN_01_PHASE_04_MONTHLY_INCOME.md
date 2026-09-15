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
- **Chunk 3** (split into two sub-passes - see Notes and deviations):
  - [x] Build shared `IncomeEntryDisplayRow`/`IncomeEntryEditRow` components
        and use them for Monthly's income rows (logged entries and
        placeholder pay dates both now edit via `IncomeEntryEditRow`'s
        sheet, not an inline row).
  - [x] Replace Outgoing lines' inline row editing (utility/recurring
        bill/subscription/expense actual) with a sheet
        (`OutgoingLineEditSheet`).
  - [x] `ActionMenu` for rows with more than two actions - not needed:
        every row in Monthly has at most one action once editing moved off
        the row (Edit; the Paid checkbox is a field, not an action), so
        this is satisfied trivially rather than built.
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
- AGENTS.md's Web conventions section described `IncomeEntryDisplayRow.svelte`
  /`IncomeEntryEditRow.svelte` as already existing for the Income page before
  this phase built them - they didn't exist at the start of Phase 4. Now
  built (chunk 3, first sub-pass) and used by Monthly; Income itself
  (chunk 4) still needs to adopt them, which is when AGENTS.md's wording
  becomes accurate. `IncomeEntryEditRow` diverges from what the name alone
  implies: DESIGN.md mandates edit-in-a-sheet, never an inline row, so it
  renders a `ResponsiveFormSheet`'s form fields, not a `<tr>` - only
  `IncomeEntryDisplayRow` renders a real table row. `IncomeEntryDisplayRow`'s
  `leading` snippet (a `Snippet<[IncomeEntry]>`) covers Monthly's Owner
  column; its separate `projected` prop (omit entirely to hide the column)
  covers the aligned Projected figure - AGENTS.md's "leading snippet ...
  e.g. Monthly's Owner/Projected columns" undersells that Projected is its
  own prop, not part of the snippet, since the two columns aren't adjacent
  in the row's markup.
- Chunk 3 turned out to have two genuinely different-sized pieces - the
  income-entry sheet conversion (small, well-scoped, matches the
  AGENTS.md-named component pair) and the Outgoing lines sheet conversion
  (six edit modes - utility/recurring-bill/subscription/expense-add/
  expense-edit/expense-multiple - each with its own fields, plus a delete
  path) - so it's landing as two sub-passes rather than one commit.
  Everything above this note is the first sub-pass; the Outgoing lines
  conversion is still open.
- Deleting a logged income entry now confirms through `confirmDestructive`
  (an `AlertDialog`, per DESIGN.md's interaction rules) instead of deleting
  immediately with no confirmation at all, which is what the pre-Phase-4
  inline-edit version did - a real behaviour addition, not just a
  presentation change, done alongside the sheet conversion since both are
  "how this row's actions work" changes. Save/delete/accept mutations on
  Monthly's income rows now also confirm with a Sonner toast, matching
  DESIGN.md's interaction rules (previously mutations here had no toast at
  all).
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
- **Corrected (was misdiagnosed as a jsdom/Svelte render-order bug):** a
  `<select>` that renders empty despite having a matching `<option>` - and
  that clears again the moment the user picks one - is a **value-type
  mismatch**. Svelte's `select_option` compares the select's raw `value`
  against each option's raw JS value (stashed as `option.__value` from the
  template expression) with `Object.is`, so a `String(id)` select value
  never matches a numeric `id` option (or vice versa) and nothing gets
  selected. This hit every select whose option values are numbers:
  Subscriptions' "For" (user id) rendered blank on open and went blank on
  choose, and the shared `CategorySelect` blanked out once the caller's
  form state had stored the **string** that a DOM change produces (the
  numeric `categoryId` from `toFormValues` had matched by luck). The fix is
  to normalise both sides to strings - `String(...)` on every numeric
  option value, and a string select `value`. The earlier diagnosis (that
  the value simply wasn't applied on the options' render pass, requiring a
  `bind:this` + `$effect` imperative `.value =` workaround, as
  `IncomeEntryEditRow`'s old `ownerSelectEl` did) was wrong: that workaround
  only appeared to fix it because assigning the DOM `value` property
  coerces types. `IncomeEntryEditRow` is now plain `bind:value` +
  `String(u.id)` options, with no workaround. Regression tests pin this in
  `OutgoingFormSheet.spec.ts` (numeric user/select options prefill) and
  `CategorySelect.spec.ts` (string value against numeric options) - the old
  specs passed because none asserted a _pre-filled_ select against numeric
  option values.
- Drawer content in this stack (vaul-svelte) attaches a `pointerdown`
  handler needing `setPointerCapture`, unimplemented in jsdom - clicking
  anything inside a `ResponsiveFormSheet` with `@testing-library/user-event`
  (real pointer events) throws an uncaught `TypeError` in the mobile/Drawer
  branch (the jsdom default - see `ResponsiveFormSheet.spec.ts`). Tests
  don't fail outright but vitest flags it as an unhandled error that
  "might cause false positive tests" - use `fireEvent` instead of
  `userEvent` for interactions inside a `ResponsiveFormSheet`'s body
  (`IncomeEntryEditRow.spec.ts`, matching `OutgoingFormSheet.spec.ts`'s
  existing convention) rather than `userEvent`.
- Chunk 3's second sub-pass (`OutgoingLineEditSheet`) collapsed six inline
  edit modes into one sheet driven by a discriminator (`utility`,
  `recurring-bill`, `subscription`, `expense-add`, `expense-edit`,
  `expense-multiple`). Only the first two of those are "real" modes with
  extra fields - a utility adds a Received-on date on top of Amount, every
  other mode is Amount alone - so the sheet is mostly one Amount input plus
  conditional extras. `expense-multiple` is the odd one out: with more than
  one actual logged in the month there is nothing sensible to collapse to a
  single Amount, so the sheet renders no form at all, just a sentence and a
  button through to the expense's own detail page. `expense-edit` (exactly
  one actual) is the only mode with a delete action, matching the old
  inline behaviour; Delete now confirms through `confirmDestructive` and
  every save/add/remove toasts, which the inline version didn't.
- Monthly's outgoing rows no longer render an inline edit state at all, so
  `OutgoingLinesTable` lost its `editingExpenseKey`/`editExpenseMode`/
  `$bindable` amount+date props and its Save/Cancel/Delete buttons - the
  table is now purely a table again, and the page owns one
  `expenseEditTarget` instead of the six-field state cluster. `+page.svelte`
  is 557 lines after both chunk 3 sub-passes (down from 1497, still over the
  ~500 target - the remainder is the orchestration script). Two known
  jsdom quirks recurred here and are worked around in `page.spec.ts` rather
  than the app: interactions inside the sheet need `fireEvent` (the
  vaul-svelte pointer-capture issue above), and re-opening the same row's
  sheet in the same test needs `fireEvent.click` too, because the row
  briefly sits under the closing sheet's `pointer-events: none` overlay.
- Two copy fixes rode along in files this sub-pass already touched: Monthly's
  "Manage income sources →" lost its arrow (DESIGN.md forbids `→` suffixes
  on links), and the multi-actual expense row's "View all →" is gone
  entirely, replaced by the sheet's "Open {line}" button. The same `→`
  pattern still exists on `routes/+page.svelte`'s "View all recurring bills
  →" - out of scope for this phase, flag if the dashboard is touched later.
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
