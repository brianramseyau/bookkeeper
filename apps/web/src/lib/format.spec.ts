import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatDaysUntilDue, monthName, monthShortName } from './format'

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

describe('formatDate', () => {
  it('formats an ISO datetime string', () => {
    expect(formatDate('2026-01-19T00:00:00.000+00:00')).toBe('19 Jan 2026')
  })

  it('renders an em dash for null', () => {
    expect(formatDate(null)).toBe('—')
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
