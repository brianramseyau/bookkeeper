import { test } from '@japa/runner'
import type Utility from '#models/utility'
import type UtilityBill from '#models/utility_bill'
import {
  expandUtilityBillsToMonthlyShares,
  isUtilityBillingMonth,
  mostRecentUtilityBill,
  utilityPeriodMonths,
} from '#services/utility_billing_period'

function fakeUtility(frequency: string): Utility {
  return { frequency } as Utility
}

function fakeBill(id: number, year: number, month: number, amount: number): UtilityBill {
  return { id, year, month, amount } as UtilityBill
}

test.group('utilityPeriodMonths', () => {
  test('maps each known frequency to its number of months', ({ assert }) => {
    assert.equal(utilityPeriodMonths('monthly'), 1)
    assert.equal(utilityPeriodMonths('quarterly'), 3)
    assert.equal(utilityPeriodMonths('biannual'), 6)
    assert.equal(utilityPeriodMonths('annual'), 12)
  })

  test('falls back to 1 for an unrecognized frequency', ({ assert }) => {
    assert.equal(utilityPeriodMonths('fortnightly'), 1)
  })
})

test.group('mostRecentUtilityBill', () => {
  test('returns null for an empty list', ({ assert }) => {
    assert.isNull(mostRecentUtilityBill([]))
  })

  test('picks the chronologically latest bill, not the last in the array', ({ assert }) => {
    const bills = [fakeBill(1, 2025, 2, 10), fakeBill(2, 2025, 8, 10), fakeBill(3, 2025, 5, 10)]

    assert.equal(mostRecentUtilityBill(bills)?.id, 2)
  })
})

test.group('isUtilityBillingMonth', () => {
  test('every month is a billing month for a monthly utility', ({ assert }) => {
    const utility = fakeUtility('monthly')

    assert.isTrue(isUtilityBillingMonth(utility, [], 2026, 3))
  })

  test('any month is a billing month when no bills exist yet', ({ assert }) => {
    const utility = fakeUtility('quarterly')

    assert.isTrue(isUtilityBillingMonth(utility, [], 2026, 3))
  })

  test('the month of an existing bill is always a billing month', ({ assert }) => {
    const utility = fakeUtility('quarterly')
    const bills = [fakeBill(1, 2026, 4, 369.49)]

    assert.isTrue(isUtilityBillingMonth(utility, bills, 2026, 4))
  })

  test('months in between billing months are not billing months', ({ assert }) => {
    const utility = fakeUtility('quarterly')
    const bills = [fakeBill(1, 2026, 4, 369.49)]

    assert.isFalse(isUtilityBillingMonth(utility, bills, 2026, 2))
    assert.isFalse(isUtilityBillingMonth(utility, bills, 2026, 3))
  })

  test('predicts the next billing month by cadence from the most recent bill', ({ assert }) => {
    const utility = fakeUtility('quarterly')
    const bills = [fakeBill(1, 2026, 4, 369.49)]

    assert.isTrue(isUtilityBillingMonth(utility, bills, 2026, 7))
    assert.isTrue(isUtilityBillingMonth(utility, bills, 2027, 1))
    assert.isFalse(isUtilityBillingMonth(utility, bills, 2026, 6))
  })
})

test.group('expandUtilityBillsToMonthlyShares', () => {
  test('a monthly utility maps each bill to itself unchanged', ({ assert }) => {
    const bills = [fakeBill(1, 2026, 1, 100), fakeBill(2, 2026, 2, 110)]

    const shares = expandUtilityBillsToMonthlyShares(bills, 'monthly')

    assert.deepEqual(shares, [
      {
        year: 2026,
        month: 1,
        amount: 100,
        billId: 1,
        billYear: 2026,
        billMonth: 1,
        isBillingMonth: true,
      },
      {
        year: 2026,
        month: 2,
        amount: 110,
        billId: 2,
        billYear: 2026,
        billMonth: 2,
        isBillingMonth: true,
      },
    ])
  })

  test('splits a quarterly bill into 3 equal monthly shares ending at the bill month', ({
    assert,
  }) => {
    const bills = [fakeBill(1, 2026, 4, 369.49)]

    const shares = expandUtilityBillsToMonthlyShares(bills, 'quarterly')

    assert.lengthOf(shares, 3)
    assert.deepEqual(
      shares.map((s) => [s.year, s.month]),
      [
        [2026, 2],
        [2026, 3],
        [2026, 4],
      ]
    )
    for (const share of shares) {
      assert.equal(share.amount, 369.49 / 3)
      assert.equal(share.billId, 1)
      assert.equal(share.billYear, 2026)
      assert.equal(share.billMonth, 4)
    }
    assert.deepEqual(
      shares.map((s) => s.isBillingMonth),
      [false, false, true]
    )
  })

  test('handles a period that spans a year boundary', ({ assert }) => {
    const bills = [fakeBill(1, 2026, 1, 300)]

    const shares = expandUtilityBillsToMonthlyShares(bills, 'quarterly')

    assert.deepEqual(
      shares.map((s) => [s.year, s.month]),
      [
        [2025, 11],
        [2025, 12],
        [2026, 1],
      ]
    )
  })

  test('expands multiple bills independently', ({ assert }) => {
    const bills = [fakeBill(1, 2026, 4, 300), fakeBill(2, 2026, 7, 330)]

    const shares = expandUtilityBillsToMonthlyShares(bills, 'quarterly')

    assert.lengthOf(shares, 6)
    assert.deepEqual(
      shares.filter((s) => s.billId === 2).map((s) => [s.year, s.month]),
      [
        [2026, 5],
        [2026, 6],
        [2026, 7],
      ]
    )
  })
})
