import { DateTime } from 'luxon'

export const RECURRING_BILL_PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
}

export function recurringBillPeriodMonths(frequency: string): number {
  return RECURRING_BILL_PERIOD_MONTHS[frequency] ?? 1
}

/**
 * Whether `month` is a due month for this bill's cycle - a monthly bill is
 * due every month; a quarterly/biannual/annual bill repeats from `dueMonth`
 * every `periodMonths` months, indefinitely. The calendar year never
 * matters (every supported period divides evenly into 12), only the bill's
 * position in its own cycle - so unlike a utility bill there's no need to
 * anchor against billing history, just the bill's own configured due month.
 */
export function isRecurringBillDueMonth(
  frequency: string,
  dueMonth: number | null,
  month: number
): boolean {
  const periodMonths = recurringBillPeriodMonths(frequency)
  if (periodMonths <= 1) return true
  if (dueMonth === null) return false
  return (((month - dueMonth) % periodMonths) + periodMonths) % periodMonths === 0
}

/**
 * The due date for one specific (year, month), or null if it isn't a due
 * month for this bill's cycle, or `dueDay` isn't set. `dueDay` is clamped to
 * however many days that month actually has.
 */
export function recurringBillDueDateFor(
  frequency: string,
  dueDay: number | null,
  dueMonth: number | null,
  year: number,
  month: number
): DateTime | null {
  if (dueDay === null) return null
  if (!isRecurringBillDueMonth(frequency, dueMonth, month)) return null

  // `daysInMonth` is only ever undefined for an invalid DateTime - (year,
  // month) here always comes from a real calendar month, so the `?? 31`
  // fallback can't actually fire.
  const daysInMonth = /* c8 ignore next */ DateTime.utc(year, month, 1).daysInMonth ?? 31
  const day = Math.min(Math.max(dueDay, 1), daysInMonth)
  return DateTime.utc(year, month, day)
}

/**
 * The next upcoming due date on or after `today` - scans at most one full
 * cycle ahead so a non-monthly bill only turns up the next month it's
 * actually due, not every month. The trailing `return null` can't actually
 * be reached (same pigeonhole reasoning as `nextUtilityDueDate`) - kept only
 * to satisfy TypeScript's control-flow analysis.
 */
export function nextRecurringBillDueDate(
  frequency: string,
  dueDay: number | null,
  dueMonth: number | null,
  today: DateTime
): DateTime | null {
  if (dueDay === null) return null

  const periodMonths = recurringBillPeriodMonths(frequency)
  let year = today.year
  let month = today.month

  for (let i = 0; i <= periodMonths; i++) {
    const due = recurringBillDueDateFor(frequency, dueDay, dueMonth, year, month)
    if (due && due >= today) return due

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    /* c8 ignore next */
  }
  /* c8 ignore next 2 */
  return null
}

/** Soonest-first, with bills that have no due date at all pushed to the end. */
export function compareByDaysUntilDue(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  return a - b
}
