import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { currentFinancialYear, financialYearMonths } from '#services/financial_year'

test.group('currentFinancialYear', () => {
  test('matches the ending year of the Jul-Jun financial year containing today', ({ assert }) => {
    const now = DateTime.now()
    const expected = now.month >= 7 ? now.year + 1 : now.year
    assert.equal(currentFinancialYear(), expected)
  })
})

test.group('financialYearMonths', () => {
  test('returns 12 (year, month) pairs from July of fyEndYear-1 through June of fyEndYear', ({
    assert,
  }) => {
    assert.deepEqual(financialYearMonths(2026), [
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
