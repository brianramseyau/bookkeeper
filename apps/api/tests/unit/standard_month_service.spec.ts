import { test } from '@japa/runner'
import type Utility from '#models/utility'
import type UtilityBill from '#models/utility_bill'
import { StandardMonthService } from '#services/standard_month_service'

/**
 * utilityDueDate() and customPeriodsPerYear() are pure functions of their
 * arguments with no DB access, but are private - tests reach them the same
 * way the class itself does, via bracket access, using plain fake objects
 * that only carry the fields those two methods actually read.
 */
function fakeUtility(overrides: Partial<Utility>): Utility {
  return overrides as Utility
}

function fakeBill(year: number, month: number): UtilityBill {
  return { year, month } as UtilityBill
}

function callUtilityDueDate(
  service: StandardMonthService,
  utility: Utility,
  bills: UtilityBill[],
  year: number,
  month: number
): string | null {
  return (
    service as unknown as {
      utilityDueDate(u: Utility, b: UtilityBill[], y: number, m: number): string | null
    }
  ).utilityDueDate(utility, bills, year, month)
}

function callCustomPeriodsPerYear(
  service: StandardMonthService,
  value: number | null,
  unit: string | null
): number {
  return (
    service as unknown as {
      customPeriodsPerYear(v: number | null, u: string | null): number
    }
  ).customPeriodsPerYear(value, unit)
}

test.group('StandardMonthService.utilityDueDate', () => {
  test('returns null when the utility has no configured due offset', ({ assert }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: null, frequency: 'monthly' })

    const result = callUtilityDueDate(service, utility, [], 2026, 2)

    assert.isNull(result)
  })

  test('a monthly utility gets a due date every month, offset from month-end', ({ assert }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 0, frequency: 'monthly' })

    const result = callUtilityDueDate(service, utility, [], 2026, 1)

    assert.equal(result, '2026-01-31T00:00:00.000Z')
  })

  test('applies the configured day offset from month-end (Water: 28 days)', ({ assert }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 28, frequency: 'monthly' })

    const result = callUtilityDueDate(service, utility, [], 2026, 2)

    assert.equal(result, '2026-03-28T00:00:00.000Z')
  })

  test('a quarterly utility only shows a due date in months aligned to its last bill', ({
    assert,
  }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 14, frequency: 'quarterly' })
    const bills = [fakeBill(2026, 1)]

    // Same month as the anchor bill - due.
    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2026, 1))
    // 3 months later (one quarter on) - due again.
    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2026, 4))
    // 1 or 2 months off the quarterly cadence - not due.
    assert.isNull(callUtilityDueDate(service, utility, bills, 2026, 2))
    assert.isNull(callUtilityDueDate(service, utility, bills, 2026, 3))
  })

  test('a quarterly utility with no bills yet is not restricted by cadence', ({ assert }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 14, frequency: 'quarterly' })

    const result = callUtilityDueDate(service, utility, [], 2026, 2)

    assert.isNotNull(result)
  })

  test('anchors on the most recent bill when several exist, not the first', ({ assert }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 0, frequency: 'biannual' })
    const bills = [fakeBill(2025, 2), fakeBill(2025, 8), fakeBill(2025, 5)]

    // Anchor should be month 8 (the latest), so month 8 and month 2 (6 months
    // on) are due; month 5 (3 months off cadence) is not.
    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2025, 8))
    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2026, 2))
    assert.isNull(callUtilityDueDate(service, utility, bills, 2025, 5))
  })

  test('an annual utility is due only in the same calendar month as its anchor bill', ({
    assert,
  }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 7, frequency: 'annual' })
    const bills = [fakeBill(2025, 6)]

    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2026, 6))
    assert.isNull(callUtilityDueDate(service, utility, bills, 2026, 7))
  })

  test('an unrecognized frequency falls back to a period of 1 month (due every month)', ({
    assert,
  }) => {
    const service = new StandardMonthService()
    const utility = fakeUtility({ dueOffsetDays: 5, frequency: 'fortnightly' })
    const bills = [fakeBill(2026, 1)]

    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2026, 2))
    assert.isNotNull(callUtilityDueDate(service, utility, bills, 2026, 3))
  })
})

test.group('StandardMonthService.customPeriodsPerYear', () => {
  test('returns 1 when either the value or unit is missing', ({ assert }) => {
    const service = new StandardMonthService()

    assert.equal(callCustomPeriodsPerYear(service, null, 'weeks'), 1)
    assert.equal(callCustomPeriodsPerYear(service, 2, null), 1)
  })

  test('computes periods per year for days, weeks and months', ({ assert }) => {
    const service = new StandardMonthService()

    assert.equal(callCustomPeriodsPerYear(service, 2, 'weeks'), 26)
    assert.equal(callCustomPeriodsPerYear(service, 14, 'days'), 365 / 14)
    assert.equal(callCustomPeriodsPerYear(service, 3, 'months'), 4)
  })

  test('falls back to 1 period per year for an unrecognized unit', ({ assert }) => {
    const service = new StandardMonthService()

    assert.equal(callCustomPeriodsPerYear(service, 2, 'quarters'), 1)
  })
})
