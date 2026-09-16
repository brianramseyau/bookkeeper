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

/** The ending year of the Jul-Jun financial year containing the given calendar year/month. */
export function financialYearFor(year: number, month: number): number {
  return month >= 7 ? year + 1 : year
}

/** Today's date as a `YYYY-MM-DD` string in local time, for `<input type="date">` defaults. */
export function todayISO(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** e.g. `financialYearLabel(2026)` -> `"FY 2025-26"` (Jul 2025 - Jun 2026). */
export function financialYearLabel(fyEndYear: number): string {
  const shortEndYear = String(fyEndYear).slice(-2)
  return `FY ${fyEndYear - 1}-${shortEndYear}`
}

/**
 * The 12 `{ year, month }` pairs making up a Jul-Jun financial year, in
 * calendar order (Jul of `fyEndYear - 1` through Jun of `fyEndYear`) -
 * mirrors the API's `financial_year.ts#financialYearMonths`.
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

/**
 * Month/year only, hiding the day - for fields stored day-for-day in the
 * database but only ever entered/meaningful at month granularity (expense
 * monthly actuals, whose `occurred_on` day is derived as the last day of
 * the month). Reads the year/month in UTC so a midnight UTC date column
 * value never shifts month under a negative local offset.
 */
export function formatMonthYear(isoDate: string | null): string {
  if (!isoDate) return '—'
  const date = new Date(isoDate)
  return monthYearLabel(date.getUTCFullYear(), date.getUTCMonth() + 1)
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Like `formatDate`, but including the time - for timestamps (e.g. backup runs) where the day alone isn't enough to tell entries apart. */
export function formatDateTime(isoDate: string | null): string {
  if (!isoDate) return '—'
  return dateTimeFormatter.format(new Date(isoDate))
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

/** Rounds to 2 decimal places - avoids float noise (e.g. 0.1 + 0.2) in money math. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatFileSize(bytes: number): string {
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  const precision = unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${FILE_SIZE_UNITS[unitIndex]}`
}

export function formatDaysUntilDue(days: number | null): string {
  if (days === null) return '—'
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days === 1 ? '' : 's'}`
}

/** Matches the API's own `DUE_SOON_WINDOW_DAYS` (recurring_bills_controller.ts). */
const DUE_SOON_WINDOW_DAYS = 30

/**
 * The `due`/`over` status tone (DESIGN.md → Colour) for a days-until-due
 * figure - overdue is `over`, due within the window is `due`, otherwise no
 * tone. Shared by every "next due" stat so bills (server-computed
 * `daysUntilDue`) and utilities (`daysUntil()` below, computed client-side)
 * apply the same threshold to whatever day count they're given.
 */
export function dueDateTone(days: number | null): 'default' | 'due' | 'over' {
  if (days === null) return 'default'
  if (days < 0) return 'over'
  if (days <= DUE_SOON_WINDOW_DAYS) return 'due'
  return 'default'
}

/**
 * Whole calendar days between today and isoDate - negative if isoDate is in
 * the past. Both sides are read as the browser's own local calendar date
 * (not UTC): "today" has to match what the user is actually looking at, and
 * since the API's date columns are anchored to UTC midnight (see
 * `formatDate`), reading the due date's local components lands on the same
 * calendar day it renders as everywhere else in the app. Using UTC for
 * "today" instead would lag the local date by one day for part of the day
 * in any positive-UTC-offset timezone (e.g. AU) - this app's whole audience.
 */
export function daysUntil(isoDate: string): number {
  const due = new Date(isoDate)
  const dueLocalMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const now = new Date()
  const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((dueLocalMidnight - todayLocalMidnight) / 86_400_000)
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
