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
 * Phrased relative to "now" rather than "due"/"overdue" - unlike
 * formatDaysUntilDue, this labels dates that may be well in the past (e.g.
 * browsing a bygone month), where "overdue" would misleadingly imply
 * something still owed.
 */
export function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  const diffDays = daysUntil(isoDate)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 0) return `In ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}
