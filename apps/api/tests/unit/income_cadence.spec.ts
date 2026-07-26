import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type IncomeSource from '#models/income_source'
import {
  monthlyEquivalentAmount,
  payDatesInMonth,
  payPeriodsInMonth,
} from '#services/income_cadence'

function fakeSource(overrides: Partial<IncomeSource>): IncomeSource {
  return {
    frequency: 'monthly',
    payDayOfMonth: null,
    weekendRollback: false,
    anchorDate: null,
    ...overrides,
  } as IncomeSource
}

test.group('payDatesInMonth / monthly', () => {
  test('returns the configured pay day as a single date', ({ assert }) => {
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 14 })
    const dates = payDatesInMonth(source, 2026, 3)
    assert.lengthOf(dates, 1)
    assert.equal(dates[0]!.toISODate(), '2026-03-14')
  })

  test('clamps the pay day to the last day of a shorter month', ({ assert }) => {
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 31 })
    const dates = payDatesInMonth(source, 2026, 4)
    assert.equal(dates[0]!.toISODate(), '2026-04-30')
  })

  test('returns no dates when no pay day is configured', ({ assert }) => {
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: null })
    assert.deepEqual(payDatesInMonth(source, 2026, 3), [])
  })

  test('rolls a Saturday pay day back to Friday when weekendRollback is set', ({ assert }) => {
    // 2026-11-14 is a Saturday.
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 14, weekendRollback: true })
    const dates = payDatesInMonth(source, 2026, 11)
    assert.equal(dates[0]!.toISODate(), '2026-11-13')
  })

  test('rolls a Sunday pay day back to Friday when weekendRollback is set', ({ assert }) => {
    // 2026-11-15 is a Sunday.
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 15, weekendRollback: true })
    const dates = payDatesInMonth(source, 2026, 11)
    assert.equal(dates[0]!.toISODate(), '2026-11-13')
  })

  test('leaves a weekend pay day alone when weekendRollback is not set', ({ assert }) => {
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 14, weekendRollback: false })
    const dates = payDatesInMonth(source, 2026, 11)
    assert.equal(dates[0]!.toISODate(), '2026-11-14')
  })
})

test.group('payDatesInMonth / fortnightly', () => {
  test('returns no dates when no anchor date is configured', ({ assert }) => {
    const source = fakeSource({ frequency: 'fortnightly', anchorDate: null })
    assert.deepEqual(payDatesInMonth(source, 2026, 7), [])
  })

  test('walks forward from the anchor in 14-day steps within the month', ({ assert }) => {
    const source = fakeSource({
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })
    const dates = payDatesInMonth(source, 2026, 8).map((d) => d.toISODate())
    assert.deepEqual(dates, ['2026-08-05', '2026-08-19'])
  })

  test('finds exactly 2 pay periods in a typical month', ({ assert }) => {
    const source = fakeSource({
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })
    assert.equal(payPeriodsInMonth(source, 2026, 2), 2)
  })

  test('finds 3 pay periods in a month the cycle lines up 3 times', ({ assert }) => {
    const source = fakeSource({
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })
    const dates = payDatesInMonth(source, 2026, 4).map((d) => d.toISODate())
    assert.deepEqual(dates, ['2026-04-01', '2026-04-15', '2026-04-29'])
  })

  test('handles a month entirely before the anchor date the same way (pure modular cycle)', ({
    assert,
  }) => {
    const source = fakeSource({
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })
    const dates = payDatesInMonth(source, 2025, 1).map((d) => d.toISODate())
    assert.lengthOf(dates, 2)
  })
})

test.group('payPeriodsInMonth', () => {
  test('is the count of payDatesInMonth', ({ assert }) => {
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 14 })
    assert.equal(payPeriodsInMonth(source, 2026, 3), 1)
  })
})

test.group('monthlyEquivalentAmount', () => {
  test('is the raw expected amount for a monthly source', ({ assert }) => {
    const source = fakeSource({ frequency: 'monthly', payDayOfMonth: 14, expectedAmount: 3885.72 })
    assert.equal(monthlyEquivalentAmount(source), 3885.72)
  })

  test('amortizes a fortnightly source over 26 pay periods a year', ({ assert }) => {
    const source = fakeSource({ frequency: 'fortnightly', expectedAmount: 2607.82 })
    assert.equal(monthlyEquivalentAmount(source), (2607.82 * 26) / 12)
  })
})
