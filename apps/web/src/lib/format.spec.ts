import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  currentFinancialYear,
  financialYearLabel,
  financialYearMonths,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDaysUntilDue,
  formatFileSize,
  formatMonthYear,
  formatRelativeDate,
  monthName,
  monthShortName,
  monthYearLabel,
  round2,
  todayISO,
} from './format'

describe('formatCurrency', () => {
  it('formats a positive amount as AUD currency', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats a negative amount', () => {
    expect(formatCurrency(-42)).toBe('-$42.00')
  })

  it('renders an em dash for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })
})

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.239)).toBe(1.24)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })

  it('leaves an already-2dp value unchanged', () => {
    expect(round2(42.5)).toBe(42.5)
  })
})

describe('monthName', () => {
  it('maps 1-12 to full month names', () => {
    expect(monthName(1)).toBe('January')
    expect(monthName(7)).toBe('July')
    expect(monthName(12)).toBe('December')
  })

  it('falls back to the raw number for an out-of-range month', () => {
    expect(monthName(13)).toBe('13')
    expect(monthName(0)).toBe('0')
  })
})

describe('monthShortName', () => {
  it('truncates the full month name to three letters', () => {
    expect(monthShortName(1)).toBe('Jan')
    expect(monthShortName(9)).toBe('Sep')
  })
})

describe('currentFinancialYear', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current calendar year when still before July', () => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    expect(currentFinancialYear()).toBe(2026)
  })

  it('returns next year once July starts', () => {
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'))
    expect(currentFinancialYear()).toBe(2027)
  })
})

describe('todayISO', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats today as a YYYY-MM-DD string in local time', () => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    expect(todayISO()).toBe('2026-03-15')
  })

  it('zero-pads single-digit month and day', () => {
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'))
    expect(todayISO()).toBe('2026-07-01')
  })
})

describe('financialYearLabel', () => {
  it('formats as FY <start>-<short end>', () => {
    expect(financialYearLabel(2026)).toBe('FY 2025-26')
  })
})

describe('monthYearLabel', () => {
  it('combines the short month name and year', () => {
    expect(monthYearLabel(2025, 7)).toBe('Jul 2025')
  })
})

describe('financialYearMonths', () => {
  it('returns 12 (year, month) pairs from July of fyEndYear-1 through June of fyEndYear', () => {
    expect(financialYearMonths(2026)).toEqual([
      { year: 2025, month: 7 },
      { year: 2025, month: 8 },
      { year: 2025, month: 9 },
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ])
  })
})

describe('formatDate', () => {
  it('formats an ISO datetime string', () => {
    expect(formatDate('2026-01-19T00:00:00.000+00:00')).toBe('19 Jan 2026')
  })

  it('renders an em dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })
})

describe('formatMonthYear', () => {
  it('formats an ISO datetime string as month and year only', () => {
    expect(formatMonthYear('2026-01-19T00:00:00.000+00:00')).toBe('Jan 2026')
  })

  it('handles a bare YYYY-MM-DD date string', () => {
    expect(formatMonthYear('2026-12-31')).toBe('Dec 2026')
  })

  it('renders an em dash for null', () => {
    expect(formatMonthYear(null)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('formats an ISO datetime string including the time', () => {
    expect(formatDateTime('2026-01-19T03:05:00.000+00:00')).toBe('19 Jan 2026, 3:05 am')
  })

  it('renders an em dash for null', () => {
    expect(formatDateTime(null)).toBe('—')
  })
})

describe('formatFileSize', () => {
  it('formats bytes with no decimal place', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('formats kilobytes with one decimal place', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
  })

  it('caps at gigabytes rather than continuing to terabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1024.0 GB')
  })
})

describe('formatDaysUntilDue', () => {
  it('renders an em dash for null', () => {
    expect(formatDaysUntilDue(null)).toBe('—')
  })

  it('renders "Due today" for zero', () => {
    expect(formatDaysUntilDue(0)).toBe('Due today')
  })

  it('pluralizes days remaining', () => {
    expect(formatDaysUntilDue(1)).toBe('Due in 1 day')
    expect(formatDaysUntilDue(5)).toBe('Due in 5 days')
  })

  it('pluralizes overdue days', () => {
    expect(formatDaysUntilDue(-1)).toBe('Overdue by 1 day')
    expect(formatDaysUntilDue(-5)).toBe('Overdue by 5 days')
  })
})

describe('formatRelativeDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an em dash for null', () => {
    expect(formatRelativeDate(null)).toBe('—')
  })

  it('renders "Today" for the current date', () => {
    vi.setSystemTime(new Date('2026-03-15T09:00:00.000Z'))
    expect(formatRelativeDate('2026-03-15T00:00:00.000+00:00')).toBe('Today')
  })

  it('renders "Tomorrow" for the next day but the actual date for yesterday', () => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    expect(formatRelativeDate('2026-03-16T00:00:00.000+00:00')).toBe('Tomorrow')
    expect(formatRelativeDate('2026-03-14T00:00:00.000+00:00')).toBe('14 Mar 2026')
  })

  it('renders a day count for a future date', () => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    expect(formatRelativeDate('2026-03-20T00:00:00.000+00:00')).toBe('In 5 days')
  })

  it('renders the actual date instead of a day count for a past date', () => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    expect(formatRelativeDate('2026-03-05T00:00:00.000+00:00')).toBe('5 Mar 2026')
  })

  it('renders the actual date for a date far in the past, instead of a large day count', () => {
    vi.setSystemTime(new Date('2026-09-15T00:00:00.000Z'))
    expect(formatRelativeDate('2026-02-15T00:00:00.000+00:00')).toBe('15 Feb 2026')
  })

  it('ignores time-of-day when computing the day difference', () => {
    vi.setSystemTime(new Date('2026-03-15T23:30:00.000Z'))
    expect(formatRelativeDate('2026-03-16T00:10:00.000+00:00')).toBe('Tomorrow')
  })
})
