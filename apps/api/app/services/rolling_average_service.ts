export interface MonthlyAmount {
  year: number
  month: number
  amount: number
}

/** Like `MonthlyAmount`, but the amount may be missing (e.g. a bill paid without a figure). */
export interface NullableMonthlyAmount {
  year: number
  month: number
  amount: number | null
}

export interface TrendResult {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: MonthlyAmount[]
}

/**
 * Computes a trailing rolling average + up/down indicator from whatever
 * monthly entries actually exist - gaps (months never billed/logged) are
 * skipped rather than treated as zero, matching how the source data works.
 */
export class RollingAverageService {
  private static readonly WINDOW_SIZE = 12

  computeTrend(entries: MonthlyAmount[]): TrendResult {
    return this.summarize(entries)
  }

  /**
   * For sources where a logged month may not carry an explicit amount - a
   * recurring bill or subscription marked paid without a figure entered -
   * a missing amount falls back to the item's configured `fallbackAmount`
   * instead of the month being treated as a gap the way `computeTrend`
   * would. Months with no entry at all are still gaps.
   */
  computeTrendWithFallback(entries: NullableMonthlyAmount[], fallbackAmount: number): TrendResult {
    return this.summarize(
      entries.map((entry) => ({
        year: entry.year,
        month: entry.month,
        amount: entry.amount ?? fallbackAmount,
      }))
    )
  }

  private summarize(entries: MonthlyAmount[]): TrendResult {
    // A non-monthly utility whose billed periods overlap (e.g. two quarterly
    // bills entered a month apart instead of a full quarter apart) can
    // expand into more than one share for the same calendar month - merge
    // those into a single entry first so the trailing window represents 12
    // distinct months, not some months counted twice.
    const byMonth = new Map<string, MonthlyAmount>()
    for (const entry of entries) {
      const key = `${entry.year}-${entry.month}`
      const existing = byMonth.get(key)
      byMonth.set(key, existing ? { ...existing, amount: existing.amount + entry.amount } : entry)
    }

    const sorted = [...byMonth.values()].sort((a, b) => a.year - b.year || a.month - b.month)
    const window = sorted.slice(-RollingAverageService.WINDOW_SIZE)

    if (window.length === 0) {
      return {
        average: null,
        latestAmount: null,
        latestYear: null,
        latestMonth: null,
        trend: null,
        months: [],
      }
    }

    const average = window.reduce((sum, entry) => sum + entry.amount, 0) / window.length
    const latest = window[window.length - 1]!

    let trend: TrendResult['trend'] = null
    if (window.length >= 2) {
      const priorEntries = window.slice(0, -1)
      const priorAverage =
        priorEntries.reduce((sum, entry) => sum + entry.amount, 0) / priorEntries.length
      if (latest.amount > priorAverage) trend = 'up'
      else if (latest.amount < priorAverage) trend = 'down'
      else trend = 'flat'
    }

    return {
      average: Math.round(average * 100) / 100,
      // Rounded for display - a split utility bill's monthly share (e.g. a
      // quarterly total divided by 3) is rarely an exact number of cents.
      latestAmount: Math.round(latest.amount * 100) / 100,
      latestYear: latest.year,
      latestMonth: latest.month,
      trend,
      months: window.map((entry) => ({ ...entry, amount: Math.round(entry.amount * 100) / 100 })),
    }
  }
}
