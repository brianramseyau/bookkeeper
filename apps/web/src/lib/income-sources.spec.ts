import { describe, expect, it } from 'vitest'
import type { IncomeSource } from './api/income'
import { cadenceLabel } from './income-sources'

function makeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 1,
    userId: 1,
    name: 'Salary',
    expectedAmount: 5000,
    frequency: 'monthly',
    payDayOfMonth: 14,
    weekendRollback: false,
    anchorDate: null,
    taxWithheld: true,
    isActive: true,
    notes: null,
    ...overrides,
  }
}

describe('cadenceLabel', () => {
  it('describes a monthly source with its pay day', () => {
    expect(cadenceLabel(makeSource())).toBe('Monthly, day 14')
  })

  it('appends the weekend-rollback note for a monthly source', () => {
    expect(cadenceLabel(makeSource({ weekendRollback: true }))).toBe(
      'Monthly, day 14 (or preceding Fri)'
    )
  })

  it('falls back to a bare "Monthly" with no pay day', () => {
    expect(cadenceLabel(makeSource({ payDayOfMonth: null }))).toBe('Monthly')
  })

  it('describes a fortnightly source with its anchor date', () => {
    expect(
      cadenceLabel(
        makeSource({
          frequency: 'fortnightly',
          payDayOfMonth: null,
          anchorDate: '2026-07-22T00:00:00.000+00:00',
        })
      )
    ).toBe('Fortnightly (from 2026-07-22)')
  })

  it('describes a fortnightly source without an anchor date', () => {
    expect(
      cadenceLabel(makeSource({ frequency: 'fortnightly', payDayOfMonth: null, anchorDate: null }))
    ).toBe('Fortnightly')
  })
})
