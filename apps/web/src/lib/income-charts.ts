import type { IncomeEntry } from './api/income'
import { financialYearFor, financialYearLabel, financialYearMonths, round2 } from './format'

export interface YearlySeriesPoint {
  month: number
  total: number
}

export interface YearlySeries {
  label: string
  color: string
  points: YearlySeriesPoint[]
}

const YEAR_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6']

/**
 * Cumulative net income per financial year, up to and including the current
 * month (a financial year's later months aren't drawn until they arrive).
 * `netOf` is the caller's per-entry netting (salary is already net; other
 * income nets through the owner's marginal rate) - passed in so this stays
 * pure.
 */
export function buildYearlySeries(
  entries: IncomeEntry[],
  netOf: (entry: IncomeEntry) => number,
  today: Date = new Date()
): YearlySeries[] {
  const byYear = new Map<number, IncomeEntry[]>()
  for (const entry of entries) {
    const fy = financialYearFor(entry.year, entry.month)
    const bucket = byYear.get(fy) ?? []
    bucket.push(entry)
    byYear.set(fy, bucket)
  }
  const fys = [...byYear.keys()].sort((a, b) => a - b)
  // 1-based month (matching `financialYearMonths`) so the in-progress month is
  // included - the API's `getIncomeYtd` includes it too, and the two charts
  // must agree.
  const nowIndex = today.getFullYear() * 12 + today.getMonth() + 1
  return fys.map((fy, index) => {
    let running = 0
    const points: YearlySeriesPoint[] = []
    for (const { year, month } of financialYearMonths(fy)) {
      if (year * 12 + month > nowIndex) break
      const net = (byYear.get(fy) ?? [])
        .filter((e) => e.year === year && e.month === month)
        .reduce((sum, e) => sum + netOf(e), 0)
      running += net
      points.push({ month, total: round2(running) })
    }
    return {
      label: financialYearLabel(fy),
      color: YEAR_COLORS[index % YEAR_COLORS.length]!,
      points,
    }
  })
}
