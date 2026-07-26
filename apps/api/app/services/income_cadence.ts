import { DateTime } from 'luxon'
import type IncomeSource from '#models/income_source'

const FORTNIGHT_DAYS = 14
const FORTNIGHTS_PER_YEAR = 26

/**
 * The real calendar dates an income source is expected to pay out within a
 * given month. A monthly source always yields at most one date (shifted to
 * the preceding Friday when `weekendRollback` is set and the pay day falls
 * on a weekend); a fortnightly source yields however many paydays actually
 * land in that month when walked forward from its anchor date in fixed
 * 14-day steps - almost always 2, but genuinely 3 a couple of times a year.
 */
export function payDatesInMonth(source: IncomeSource, year: number, month: number): DateTime[] {
  if (source.frequency === 'fortnightly') {
    if (source.anchorDate === null) return []

    const monthStart = DateTime.utc(year, month, 1)
    const monthEnd = monthStart.endOf('month').startOf('day')
    const anchor = source.anchorDate.startOf('day')

    const daysSinceAnchor = monthStart.diff(anchor, 'days').days
    const offset = ((daysSinceAnchor % FORTNIGHT_DAYS) + FORTNIGHT_DAYS) % FORTNIGHT_DAYS
    let candidate = monthStart.plus({ days: offset === 0 ? 0 : FORTNIGHT_DAYS - offset })

    const dates: DateTime[] = []
    while (candidate <= monthEnd) {
      dates.push(candidate)
      candidate = candidate.plus({ days: FORTNIGHT_DAYS })
    }
    return dates
  }

  if (source.payDayOfMonth === null) return []

  const monthEnd = DateTime.utc(year, month, 1).endOf('month')
  const day = Math.min(source.payDayOfMonth, monthEnd.day)
  let date = DateTime.utc(year, month, day)
  if (source.weekendRollback) {
    if (date.weekday === 6) date = date.minus({ days: 1 })
    else if (date.weekday === 7) date = date.minus({ days: 2 })
  }
  return [date]
}

export function payPeriodsInMonth(source: IncomeSource, year: number, month: number): number {
  return payDatesInMonth(source, year, month).length
}

/**
 * A single "average month" figure for a source regardless of its real
 * cadence - a fortnightly source is amortized over its 26 pay periods a
 * year, the same way non-monthly recurring bills are amortized elsewhere.
 * Used for at-a-glance totals (e.g. "$X/mo across all your sources") where
 * showing the literal per-pay-period amount would be misleading.
 */
export function monthlyEquivalentAmount(source: IncomeSource): number {
  if (source.frequency === 'fortnightly') {
    return (source.expectedAmount * FORTNIGHTS_PER_YEAR) / 12
  }
  return source.expectedAmount
}
