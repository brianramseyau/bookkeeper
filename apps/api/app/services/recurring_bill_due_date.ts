import type { DateTime } from 'luxon'

const FREQUENCY_PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
}

function advance(
  date: DateTime,
  frequency: string,
  customIntervalValue: number | null,
  customIntervalUnit: string | null
): DateTime {
  if (frequency === 'custom') {
    const value = customIntervalValue ?? 1
    if (customIntervalUnit === 'days') return date.plus({ days: value })
    if (customIntervalUnit === 'weeks') return date.plus({ weeks: value })
    return date.plus({ months: value })
  }
  // The `?? 1` fallback can't fire: the `frequency` column has a DB-level
  // CHECK constraint restricting it to 'monthly'|'quarterly'|'biannual'|
  // 'annual'|'custom' - 'custom' is handled above, so every other value
  // reaching this lookup is already a key in FREQUENCY_PERIOD_MONTHS.
  const periodMonths = /* c8 ignore next */ FREQUENCY_PERIOD_MONTHS[frequency] ?? 1
  return date.plus({ months: periodMonths })
}

/**
 * A recurring bill's `nextDueOn` is a fixed anchor date set whenever it's
 * created or edited - nothing advances it as real time passes. Once that
 * date is in the past, roll it forward by the bill's own frequency until it
 * lands on the next upcoming occurrence, so a bill last edited a year ago
 * still reads as "due in N days" rather than "overdue" forever.
 */
export function resolveNextOccurrence(
  nextDueOn: DateTime | null,
  frequency: string,
  customIntervalValue: number | null,
  customIntervalUnit: string | null,
  today: DateTime
): DateTime | null {
  if (!nextDueOn) return null

  let occurrence = nextDueOn
  while (occurrence < today) {
    occurrence = advance(occurrence, frequency, customIntervalValue, customIntervalUnit)
  }
  return occurrence
}

/** Soonest-first, with bills that have no due date at all pushed to the end. */
export function compareByDaysUntilDue(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  return a - b
}
