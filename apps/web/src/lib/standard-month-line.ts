import type { StandardMonthLine } from './api/standard-month'
import { daysUntil, formatDate, formatRelativeDate } from './format'

// Mirrors the API's DUE_SOON_WINDOW_DAYS (recurring_bills_controller.ts) so
// the Due chip on the Monthly page matches the Bills page: colored (and
// always shown) once a line is overdue or due within 30 days, plain text
// otherwise.
export const DUE_SOON_WINDOW_DAYS = 30

export function lastDayOfMonthIso(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

// `dueDay` is a bare day-of-month (from a monthly recurring bill, which has
// no month/year of its own) - resolve it against the month currently being
// viewed, clamping to that month's last day (e.g. a due day of 31 in
// February).
//
// A utility's `dueDate` is a *predicted* payment date - for a non-monthly
// utility (e.g. quarterly Water, paid in arrears) it's populated as soon as
// the viewed month is cued up to be the next billing month, even before
// that quarter's bill has actually been entered. Once this month's actual
// is known the date is a confirmed fact; until then it's still shown (see
// `dueDateEstimated`) but flagged as a guess rather than suppressed
// outright.
export function resolveDueDate(
  line: StandardMonthLine,
  year: number,
  month: number
): string | null {
  if (line.dueDate) return line.dueDate
  if (line.dueDay) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const day = Math.min(line.dueDay, daysInMonth)
    return new Date(Date.UTC(year, month - 1, day)).toISOString()
  }
  return null
}

export function dueLabel(line: StandardMonthLine, year: number, month: number): string {
  return formatRelativeDate(resolveDueDate(line, year, month))
}

export function dueTitle(line: StandardMonthLine, year: number, month: number): string | undefined {
  const dueDate = resolveDueDate(line, year, month)
  if (!dueDate) return undefined
  return line.dueDateEstimated
    ? `${formatDate(dueDate)} (estimated from the average received date of past bills)`
    : formatDate(dueDate)
}

// Same red/amber pill as the Bills page's due-soon badge, so the two areas
// read consistently - null means "plain text, no chip" (a due date more
// than DUE_SOON_WINDOW_DAYS away, or no due date at all). `paid` (a real,
// user-set flag) is the sole authority on green vs red/amber: it's a
// separate fact from whether the amount is merely known, which
// resolveDueDate already covers via its own gate above.
export function dueChipClass(line: StandardMonthLine, year: number, month: number): string | null {
  const dueDate = resolveDueDate(line, year, month)
  if (!dueDate) return null
  // An estimated date isn't a real obligation yet, so it never earns the
  // red/amber urgency styling - just plain text with an "(est.)" marker
  // (see the template).
  if (line.dueDateEstimated) return null
  if (line.paid) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  }
  const days = daysUntil(dueDate)
  if (days > DUE_SOON_WINDOW_DAYS) return null
  return days < 0
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
}

// Expense lines have no due date (they're not a single billed obligation
// like a utility/recurring bill/subscription, just an aggregate of
// whatever actuals were logged), so gating the checkbox on resolveDueDate
// like the other line types would hide it for every expense, always.
// Instead, show it whenever there's an actual to reconcile against - an
// expense with nothing logged this month (actual === null) has nothing to
// mark paid.
export function canTrackPaid(line: StandardMonthLine, year: number, month: number): boolean {
  if (line.key.startsWith('expense-')) return line.actual !== null
  // A guessed due date isn't a real obligation yet - nothing to mark paid
  // against until the bill actually arrives.
  if (line.dueDateEstimated) return false
  return resolveDueDate(line, year, month) !== null
}

// `estimated` covers both `actual` and `paid` for a recurring bill or
// subscription (no payment row this far back means neither is real), but
// only `paid` for an expense - its `actual` is always genuinely logged
// spending whenever it's non-null (see standard_month_service.ts), so
// flagging it here too would mislabel real data as a guess.
export function actualIsAssumed(line: StandardMonthLine): boolean {
  return line.estimated && !line.key.startsWith('expense-')
}

// The checkbox itself stays visible even when it can't be tracked yet
// (greyed out via `disabled`) rather than disappearing, so the column reads
// consistently row to row - this explains why to anyone who hovers.
export function paidTooltip(
  line: StandardMonthLine,
  year: number,
  month: number
): string | undefined {
  // Takes priority over the disabled-state tooltips below - an assumed
  // line is usually still trackable (canTrackPaid true), so without this
  // check hovering it would show no tooltip at all despite the value on
  // screen not being a real record.
  if (line.estimated) {
    return "No record for this month this far back - assumed paid at today's amount because it's in the past. Confirm or correct it."
  }
  if (canTrackPaid(line, year, month)) return undefined
  if (line.key.startsWith('expense-')) {
    return 'No actual amount logged for this expense this month'
  }
  return line.actual === null
    ? 'No actual amount recorded for this month yet'
    : 'No due date to reconcile against this month'
}

// Maps an expense line back to the page where it's actually managed, so its
// label can link there - a recurring bill's row on that page carries a
// matching `bill-{id}` anchor (see bills/+page.svelte). Subscriptions have
// no per-item detail view and are filtered by a person tab with no owner on
// this line to pre-select, so they link to the list page only.
export function viewHref(line: StandardMonthLine): string | null {
  if (line.key.startsWith('utility-')) return `/utilities/${line.key.slice('utility-'.length)}`
  if (line.key.startsWith('recurring-bill-')) {
    return `/bills#bill-${line.key.slice('recurring-bill-'.length)}`
  }
  if (line.key.startsWith('subscription-')) return '/subscriptions'
  if (line.key.startsWith('expense-')) return `/expenses/${line.key.slice('expense-'.length)}`
  return null
}
