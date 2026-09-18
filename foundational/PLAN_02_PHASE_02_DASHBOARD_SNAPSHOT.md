# PLAN 02 · Phase 02 — Dashboard snapshot

Branch: `dashboard-two-zone-snapshot`. See [PLAN_02_OVERVIEW.md](PLAN_02_OVERVIEW.md) for how Phase 01 arrived at retiring the month strip on Monthly, and its note that a Dashboard phase would follow once that one shipped (it has, PR #29).

## Why

The Dashboard's hero, `MonthStrip` (the ▲/▼ day-positioned timeline with a running-balance line), was tried, found widely disliked, and is being thrown away everywhere - Monthly already replaced it with its unified chronological list in Phase 01; this phase replaces it on the Dashboard with a two-zone snapshot: "Right now" (this month's position) and "Over time" (a 12-month trend), so the page answers both "where do I stand" and "how's it going" without the strip.

`DashboardSummary` (`getDashboardSummary`) already carries everything this needs - `currentMonth.{projectedNet,actualNet}`, `totalIncome`, `monthlyExpenses[12]`, `monthlyIncome[12]`, `categoryBreakdown[]`, `upcomingBills[]`. **No backend/API changes are required or in scope for this phase.**

## Goal

Replace the Dashboard's `<MonthStrip>` + `IncomeExpenseBarChart` + `PieChart` donut with a two-zone layout: a "Right now" stat row + upcoming bills + category breakdown, and an "Over time" net-position trend chart (income/expense bars with a net line overlay, which can dip negative).

## Tasks

- [x] Run `/frontend-design` before starting.
- [x] `routes/+page.svelte`: drop `MonthStrip`, the `getStandardMonth`/`StandardMonthResult` fetch and `standardMonth` state (nothing else on this page needs it), and the `PieChart`/`incomeVsExpensePie`/`positionCenter` snippet.
- [x] Add three derived stat values reusing the page's existing `expenseTotal`/`incomeTotal`/`position` derivations: **Position** (`currentMonth.actualNet`), **vs projected** (delta between actual and projected net, tone `positive`/`due`), **savings rate this month** (`(income - expenses) / income`, blank when no income logged).
- [x] Build the "Right now" section: `StatGrid`/`StatCard` stat row (three tiles above), then the existing upcoming-bills list and `CategoryBreakdownList` card, relocated under this heading largely unchanged.
- [x] Build the "Over time" section: extend `IncomeExpenseBarChart.svelte` (rename to e.g. `NetPositionTrendChart.svelte` if the shape diverges enough) to add a net-position line (`income - expense` per month, `currentColor`/ink) over the existing income/expense bars, 12 months trailing through the selected month. Keep the click-a-bar-to-navigate-to-`/monthly` interaction and the "View as table" disclosure (add net as a third column).
- [x] Generalize `$lib/chart-utils.ts`'s `niceMax` (or add a `niceDomain(min, max)`) so the y-scale can cover a negative net value instead of assuming an all-positive domain; check whether `MonthlyExpenseChart.svelte` can share it too rather than duplicating scale math.
- [x] Two `<section>`s (`text-ink font-display text-lg` headings "Right now"/"Over time"), side by side on `lg+` (`Right Now` narrower, `Over Time` wider), stacked on mobile with Right Now first. Structure each zone as its own snippet/child component (not inlined into one template block) so a later tab-switcher (one zone visible at a time, to cut mobile scrolling) is a small follow-up, not a rewrite - don't build the tab switcher itself in this phase.
- [x] Delete `apps/web/src/lib/components/app/MonthStrip.svelte`, `apps/web/src/lib/month-strip.ts`, and their spec files outright once `grep -rln "MonthStrip\|month-strip" apps/web/src` confirms `routes/+page.svelte` was the only real caller (the one other hit, a stale comment in `MonthYearPicker.svelte`, gets updated to reference the new chart component instead).
- [x] `MonthNavHeader.svelte`: step down mobile-only font sizes, `sm+` unchanged, in both variants - `compact` heading `text-xl sm:text-2xl` → `text-lg sm:text-2xl`; `buttons` label `text-sm` → `text-xs sm:text-sm`. Check `MonthNavHeader.spec.ts` for class assertions that need updating. (`IncomeYearNav.svelte` and `Button`'s own sizing are out of scope.)
- [x] Update/rename `IncomeExpenseBarChart.spec.ts` alongside the component; add coverage for the net line and the negative-domain case.
- [x] Update `routes/+page.svelte`'s spec for the new layout and derived stats.
- [x] Screenshot review (390px/1440px, light/dark, en-AU) against DESIGN.md before committing - include a month with a deficit so the negative-domain net line actually renders, and re-check `/monthly` at 390px since `MonthNavHeader`'s `compact` variant is shared.
- [x] Update DESIGN.md: revise the "Signature element: the month strip" section/decisions-log entry to record that the strip was tried, found widely disliked, and dropped everywhere - superseded by Monthly's unified list (Phase 01) and this phase's two-zone Dashboard snapshot - rather than leaving it describing a still-live Dashboard hero.

## Acceptance criteria

- [x] Dashboard no longer renders `MonthStrip`; no `/standard-month` fetch remains on this page.
- [x] Dashboard shows a "Right now" zone (stat row, upcoming bills, category breakdown) and an "Over time" zone (net-position trend chart), stacked on mobile and side by side on `lg+`.
- [x] The trend chart correctly renders a negative net month (line dips below the zero baseline) in both themes.
- [x] `MonthNavHeader`'s mobile text is visibly smaller in both variants without regressing `sm+` or Monthly's heading.
- [x] `MonthStrip.svelte`/`month-strip.ts` are deleted; nothing references them.
- [x] `pnpm verify` passes; `pnpm --filter web test:coverage` shows no regression.
- [x] Screenshots reviewed at 390px and 1440px, light and dark.
- [x] DESIGN.md's decisions log updated.

## Notes and deviations

- **Dashboard's `MonthNavHeader` switched from `showLabel={false}` to the default (shown).** With `MonthStrip` gone, nothing else on the page displayed which month was in view - the strip used to carry that as its own heading. The "Over time" chart's card title does mention the month range, but that's not a substitute for a persistent heading.
- **The "Right now" stat row isn't `StatGrid cols={3}` as planned.** At `lg+`, this zone is only 2/5 of the page width (see Layout above); three `StatCard`s at that width truncated their currency values (`StatCard`'s value span had no way to shrink in its flex row, so it overflowed the card instead of wrapping). Fixed two ways: `StatCard`'s value span gained `min-w-0 truncate` (a shared, reusable fix - not a Dashboard-only patch), and this page's stat row uses `grid-cols-1 sm:grid-cols-3 lg:grid-cols-1` instead of `StatGrid`, since below `lg` the zone is full-width (3 columns fit fine) and only the `lg+` narrow-column case needed to drop to one column instead of truncating. Screenshot review at 1440px caught this; without it the values would have shipped silently clipped.
- **Kept `PieChart.svelte` and `getStandardMonth`/`standard-month.ts`** - both still used elsewhere (Income's charts, Monthly's own page) - this phase only removed the Dashboard's calls to them.
- **First pass only changed `MonthNavHeader`'s font sizes and left the Dashboard on the `buttons` variant** ("This Month" / "← Prev" / "Next →" text buttons in `PageHeader`'s actions slot), missing the actual ask - "use the new month picker from the top of Monthly". Corrected to match Monthly exactly: `variant="compact"` (chevron icon buttons flanking a tappable "Month Year" heading that jumps back to the current month), rendered as its own full-width row below `PageHeader` rather than squeezed into the header's actions slot - same reason Monthly's Phase 1 placed it there (the compact heading needs full width to centre). `PageHeader`'s `actions` snippet is now unused on this page (no other header action exists), so it was dropped entirely rather than left with an empty snippet.
- **"Savings rate" was dropped for the owner's stated preference** - a percentage implying per-transaction knowledge of where money went isn't something this app tracks, and could mislead. Replaced with a third "Income vs expenses" stat card, plain income minus expenses for the viewed month, distinct from "Position" (which is the API's `actualNet` and folds in carryover). Building it caught a real bug before commit: the obvious `data.totalIncome` minus a `monthlyExpenses.reduce(...)` sum are both 12-month totals (see `$lib/api/dashboard.ts` - the same window the Over time chart sums, and the same data the old donut used, correctly labelled "(12 months)" there), not the viewed month's - an early version showed a nonsensical "$15,470.91 surplus this month". Fixed by picking the one `monthlyIncome`/`monthlyExpenses` entry matching `currentMonth` instead of summing either array. Caught by eyeballing the rendered number against the chart's own September bar during screenshot review, not by a test - the unit tests were passing against mocked totals that happened to already look month-sized.
