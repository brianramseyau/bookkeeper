import { DateTime } from 'luxon'

/**
 * The Australian financial year (Jul-Jun) currently in progress, named by
 * its *ending* year - e.g. during any month from Jul 2025 through Jun
 * 2026, this returns `2026` (FY26), matching the source workbook's own
 * `Tax_FY26` table naming.
 */
export function currentFinancialYear(): number {
  const now = DateTime.now()
  return Math.floor((now.year * 12 + now.month - 7) / 12) + 1
}

/**
 * The 12 calendar `(year, month)` pairs making up financial year
 * `fyEndYear`, in chronological order - Jul `fyEndYear - 1` through Jun
 * `fyEndYear`.
 */
export function financialYearMonths(fyEndYear: number): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = []
  for (let i = 0; i < 12; i++) {
    const month = ((6 + i) % 12) + 1
    const year = month >= 7 ? fyEndYear - 1 : fyEndYear
    months.push({ year, month })
  }
  return months
}
