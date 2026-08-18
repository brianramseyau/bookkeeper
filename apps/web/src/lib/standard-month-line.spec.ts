import { describe, expect, it } from 'vitest'
import type { StandardMonthLine } from './api/standard-month'
import {
  DUE_SOON_WINDOW_DAYS,
  actualIsAssumed,
  canTrackPaid,
  dueChipClass,
  dueLabel,
  dueTitle,
  lastDayOfMonthIso,
  monthValueToLastDayIso,
  paidTooltip,
  resolveDueDate,
  viewHref,
} from './standard-month-line'

function makeLine(overrides: Partial<StandardMonthLine> = {}): StandardMonthLine {
  return {
    key: 'recurring-bill-1',
    label: 'Internet',
    projected: 80,
    actual: null,
    dueDay: null,
    dueDate: null,
    dueDateEstimated: false,
    paid: false,
    estimated: false,
    editable: true,
    receivedOn: null,
    ...overrides,
  }
}

describe('lastDayOfMonthIso', () => {
  it('returns the last calendar day of the month', () => {
    expect(lastDayOfMonthIso(2026, 2)).toBe('2026-02-28')
    expect(lastDayOfMonthIso(2024, 2)).toBe('2024-02-29')
  })
})

describe('monthValueToLastDayIso', () => {
  it('converts a YYYY-MM value to the last day of that month', () => {
    expect(monthValueToLastDayIso('2026-01')).toBe('2026-01-31')
    expect(monthValueToLastDayIso('2026-02')).toBe('2026-02-28')
    expect(monthValueToLastDayIso('2024-02')).toBe('2024-02-29')
    expect(monthValueToLastDayIso('2026-12')).toBe('2026-12-31')
  })
})

describe('resolveDueDate', () => {
  it('prefers an explicit dueDate over dueDay', () => {
    const line = makeLine({ dueDate: '2026-03-15T00:00:00.000Z', dueDay: 1 })
    expect(resolveDueDate(line, 2026, 3)).toBe('2026-03-15T00:00:00.000Z')
  })

  it('resolves a bare dueDay against the viewed month', () => {
    const line = makeLine({ dueDay: 15 })
    expect(resolveDueDate(line, 2026, 3)?.slice(0, 10)).toBe('2026-03-15')
  })

  it('clamps a dueDay past the end of a shorter month', () => {
    const line = makeLine({ dueDay: 31 })
    expect(resolveDueDate(line, 2026, 2)?.slice(0, 10)).toBe('2026-02-28')
  })

  it('returns null with neither dueDate nor dueDay', () => {
    expect(resolveDueDate(makeLine(), 2026, 3)).toBeNull()
  })
})

describe('dueLabel / dueTitle', () => {
  it('renders an em dash when there is no due date', () => {
    expect(dueLabel(makeLine(), 2026, 3)).toBe('—')
    expect(dueTitle(makeLine(), 2026, 3)).toBeUndefined()
  })

  it('flags an estimated due date in the title', () => {
    const line = makeLine({ dueDay: 15, dueDateEstimated: true })
    expect(dueTitle(line, 2026, 3)).toContain('estimated')
  })
})

describe('dueChipClass', () => {
  it('is null with no due date', () => {
    expect(dueChipClass(makeLine(), 2026, 3)).toBeNull()
  })

  it('is null for an estimated due date', () => {
    const line = makeLine({ dueDay: 1, dueDateEstimated: true })
    expect(dueChipClass(line, 2026, 3)).toBeNull()
  })

  it('is green when paid', () => {
    const line = makeLine({ dueDay: 1, paid: true })
    expect(dueChipClass(line, 2026, 3)).toContain('green')
  })

  it('is null when due date is beyond the due-soon window', () => {
    const future = new Date()
    future.setDate(future.getDate() + DUE_SOON_WINDOW_DAYS + 5)
    const line = makeLine({ dueDate: future.toISOString() })
    expect(dueChipClass(line, 2026, 3)).toBeNull()
  })

  it('is red when overdue and unpaid', () => {
    const line = makeLine({ dueDate: '2000-01-01T00:00:00.000Z' })
    expect(dueChipClass(line, 2026, 3)).toContain('red')
  })

  it('is amber when due soon and unpaid', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 1)
    const line = makeLine({ dueDate: soon.toISOString() })
    expect(dueChipClass(line, 2026, 3)).toContain('amber')
  })
})

describe('canTrackPaid', () => {
  it('is true for an expense line with a logged actual', () => {
    const line = makeLine({ key: 'expense-1', actual: 42 })
    expect(canTrackPaid(line, 2026, 3)).toBe(true)
  })

  it('is false for an expense line with no logged actual', () => {
    const line = makeLine({ key: 'expense-1', actual: null })
    expect(canTrackPaid(line, 2026, 3)).toBe(false)
  })

  it('is false for an estimated due date', () => {
    const line = makeLine({ dueDay: 1, dueDateEstimated: true })
    expect(canTrackPaid(line, 2026, 3)).toBe(false)
  })

  it('is true once a real due date resolves', () => {
    const line = makeLine({ dueDay: 1 })
    expect(canTrackPaid(line, 2026, 3)).toBe(true)
  })
})

describe('actualIsAssumed', () => {
  it('is true for an estimated recurring bill', () => {
    expect(actualIsAssumed(makeLine({ estimated: true }))).toBe(true)
  })

  it('is false for an estimated expense (its actual is always real)', () => {
    expect(actualIsAssumed(makeLine({ key: 'expense-1', estimated: true }))).toBe(false)
  })
})

describe('paidTooltip', () => {
  it('flags an assumed/estimated line first', () => {
    const line = makeLine({ estimated: true })
    expect(paidTooltip(line, 2026, 3)).toContain('assumed paid')
  })

  it('is undefined once trackable', () => {
    const line = makeLine({ dueDay: 1 })
    expect(paidTooltip(line, 2026, 3)).toBeUndefined()
  })

  it('explains an untrackable expense', () => {
    const line = makeLine({ key: 'expense-1', actual: null })
    expect(paidTooltip(line, 2026, 3)).toContain('expense')
  })

  it('explains a bill with no due date to reconcile against', () => {
    const line = makeLine({ actual: 10 })
    expect(paidTooltip(line, 2026, 3)).toContain('due date')
  })
})

describe('viewHref', () => {
  it('links a utility to its detail page', () => {
    expect(viewHref(makeLine({ key: 'utility-5' }))).toBe('/utilities/5')
  })

  it('links a recurring bill to its anchor on the Bills page', () => {
    expect(viewHref(makeLine({ key: 'recurring-bill-7' }))).toBe('/bills#bill-7')
  })

  it('links a subscription to the list page', () => {
    expect(viewHref(makeLine({ key: 'subscription-2' }))).toBe('/subscriptions')
  })

  it('links an expense to its detail page', () => {
    expect(viewHref(makeLine({ key: 'expense-9' }))).toBe('/expenses/9')
  })

  it('is null for anything unrecognized', () => {
    expect(viewHref(makeLine({ key: 'carryover' }))).toBeNull()
  })
})
