const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
})

export function formatCurrency(amount: number | null): string {
  if (amount === null) return '—'
  return currencyFormatter.format(amount)
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month)
}

export function monthShortName(month: number): string {
  return monthName(month).slice(0, 3)
}

/** The ending year of the Jul-Jun Australian financial year containing today. */
export function currentFinancialYear(): number {
  const now = new Date()
  return now.getMonth() + 1 >= 7 ? now.getFullYear() + 1 : now.getFullYear()
}

/** e.g. `financialYearLabel(2026)` -> `"FY 2025-26"` (Jul 2025 - Jun 2026). */
export function financialYearLabel(fyEndYear: number): string {
  const shortEndYear = String(fyEndYear).slice(-2)
  return `FY ${fyEndYear - 1}-${shortEndYear}`
}

/** e.g. `monthYearLabel(2025, 7)` -> `"Jul 2025"`. */
export function monthYearLabel(year: number, month: number): string {
  return `${monthShortName(month)} ${year}`
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  // The API returns date columns as a full ISO datetime (e.g.
  // "2026-01-19T00:00:00.000+00:00") - already unambiguous, parse directly.
  return dateFormatter.format(new Date(isoDate))
}

export function formatDaysUntilDue(days: number | null): string {
  if (days === null) return '—'
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days === 1 ? '' : 's'}`
}

/** Whole calendar days between today and isoDate - negative if isoDate is in the past. */
export function daysUntil(isoDate: string): number {
  const due = new Date(isoDate)
  const dueUtcMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const now = new Date()
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((dueUtcMidnight - todayUtcMidnight) / 86_400_000)
}

/**
 * Phrased relative to "now" for today/upcoming dates, since "In 3 days" is
 * more useful than the calendar date at a glance. Once a date is in the
 * past it switches to the actual date instead - "205 days ago" (e.g. when
 * browsing a bygone month) is a chore to translate into a real date, while
 * the date itself is immediately legible.
 */
export function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diffDays = daysUntil(isoDate)

  if (diffDays < 0) return formatDate(isoDate)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `In ${diffDays} days`
}
