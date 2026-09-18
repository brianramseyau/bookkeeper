# PLAN 02 — Monthly, as one list (overview)

The master doc for retiring the month strip on the Monthly page. Design lives in [DESIGN.md](DESIGN.md). Each phase has its own `PLAN_02_PHASE_NN_*.md` with tasks, acceptance criteria and a "Notes and deviations" section. When a phase is finished, tick its criteria and record deviations there. This is the "future `PLAN_NN_OVERVIEW.md` + `PLAN_NN_PHASE_NN_*.md` pair" AGENTS.md's Plans section anticipates for the next multi-phase effort after PLAN_01.

## Why

The month strip (DESIGN.md's "Signature element", built in PLAN_01 Phase 4) scrolls horizontally on mobile, snapping to today. In practice that reads as clunky rather than the intended hero moment - it's the thing the redesign was proudest of, and it's the part that feels worst on the device most sessions on this app actually happen on.

Explored with the owner as a sequence of private Artifact prototypes before any production code:

1. Two mobile-friendly alternatives to the strip - a vertical chronological feed and a tappable calendar grid - both built from identical sample data so they were a fair comparison.
2. Feedback: liked the vertical feed, but it "would need to replace the whole screen and table to work" - so the second round modelled it as the actual Monthly screen (device frame, real chrome, real controls: a Paid checkbox, Accept/Edit on projected income rows) rather than a small demo card.
3. Feedback: "needs interactions to be more touch friendly" - checkboxes and icon buttons grew to ~44px tap targets with visible pressed states, matching (and in places exceeding) DESIGN.md's existing mobile-list rules.
4. Feedback: missing the ability to edit the actual amount paid - added a bottom-drawer editor mirroring the real `OutgoingLineEditSheet` (Amount, plus Received-on for utility-style bills), wired live so the header stats recompute on save.
5. Owner: "I think that's a good concept to pivot to."

## Confirmed decisions

1. **Scope: Monthly only, for now.** The strip is also the Dashboard's hero (`routes/+page.svelte` renders `MonthStrip` directly, independently of Monthly's `MonthSummary`). Dashboard keeps its current strip through this phase; Phase 02 replaces it with a two-zone snapshot layout (see below).
2. **One chronological list** replaces `MonthSummary`'s `<MonthStrip>`, `OutgoingLinesTable` and `IncomingTable` - bills and income entries/placeholders interleaved by resolved date, not two separate tables.
3. **Existing edit surfaces are reused unchanged.** `OutgoingLineEditSheet`, `IncomeEntryEditRow`, `MonthlyLogIncomeSheet` and `CarryoverCard`'s inline edit already do exactly what the prototype's mocked-up controls simulated. This phase changes the row/list _presentation_ in `+page.svelte`'s template, not the mutation logic (`togglePaid`, `saveExpenseEditValues`, `saveEntryEditValues`, `acceptPlaceholder`, `saveCarryover`, etc. stay as-is).
4. **Carryover isn't a dated event**, so it stays out of the chronological list - shown as a compact header figure/row instead of its own full-width table.
5. **Touch targets follow the ≥44px pattern validated in the prototype** (checkbox tap area, edit pencil, Accept/Edit) - a deliberate deviation from DESIGN.md's existing note that inline row buttons are exempt from the 44px floor, given how often these specific controls get tapped on this page. Logged as a DESIGN.md decision once implemented.
6. **Branch:** this work develops on the branch the session was started on (`claude/triangle-graph-mobile-k6dy7g`) rather than a `phase-02-...` branch - the repo's own naming convention below is superseded by this session's harness-level branch assignment, not by choice.

## Phases

| Phase | Doc                                                                                  | Summary                                                                        |
| ----- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1     | [PLAN_02_PHASE_01_MONTHLY_UNIFIED_LIST.md](PLAN_02_PHASE_01_MONTHLY_UNIFIED_LIST.md) | Replace Monthly's strip + two tables with one chronological list               |
| 2     | [PLAN_02_PHASE_02_DASHBOARD_SNAPSHOT.md](PLAN_02_PHASE_02_DASHBOARD_SNAPSHOT.md)     | Replace the Dashboard's strip with a two-zone "Right now"/"Over time" snapshot |

## Per-phase workflow: checks and reviews

Same process as PLAN_01 - see [AGENTS.md](../AGENTS.md#checks-and-reviews-multi-phase-plans):

1. **Local gate:** `pnpm verify`, `pnpm test:e2e` and API coverage all pass. Screenshots at 390px and 1440px, light and dark, en-AU, reviewed against DESIGN.md with `/frontend-design`.
2. **Ask the owner** before committing and pushing to open the PR - once per phase. Fix-up commits within that PR (CI failures, review feedback) don't need to re-ask each time.
3. **Wait for all PR checks** (CI's lint/typecheck/test/e2e jobs plus Kilo Code Review), then read every review comment even once checks are green.
4. **Handle each comment on its own diff line**, reply, then resolve the thread individually.
5. **Tick the phase doc**, log deviations, update DESIGN.md's decisions log. Merge only with the owner's confirmation.

## Verification (every phase)

- `pnpm verify`
- `pnpm --filter api test:coverage` (100%, though this phase is expected to be web-only) and `pnpm --filter web test:coverage` (no regression)
- `pnpm test:e2e`
- Playwright screenshots of every touched page at 390px and 1440px, light and dark, en-AU
