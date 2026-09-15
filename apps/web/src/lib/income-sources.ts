import type { IncomeSource } from './api/income'

// Pure display helpers for the Income page's source table, kept out of the
// route component so they're unit-testable on their own (see AGENTS.md's
// "pure display/derivation logic belongs in a $lib module").

/** A human-readable cadence: monthly (with its pay day) or fortnightly (with its anchor). */
export function cadenceLabel(source: IncomeSource): string {
  if (source.frequency === 'fortnightly') {
    return source.anchorDate
      ? `Fortnightly (from ${source.anchorDate.slice(0, 10)})`
      : 'Fortnightly'
  }
  if (source.payDayOfMonth === null) return 'Monthly'
  return `Monthly, day ${source.payDayOfMonth}${source.weekendRollback ? ' (or preceding Fri)' : ''}`
}
