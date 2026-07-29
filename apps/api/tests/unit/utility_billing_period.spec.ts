import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type Utility from '#models/utility'
import type UtilityBill from '#models/utility_bill'
import {
  expandUtilityBillsToMonthlyShares,
  isUtilityBillingMonth,
  mostRecentUtilityBill,
  nextUtilityDueDate,
  utilityDueDateFor,
  utilityPeriodMonths,
} from '#services/utility_billing_period'

function fakeUtility(frequency: string, dueOffsetDays: number | null = null): Utility {
  return { frequency, dueOffsetDays } as Utility
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

  test('splits a bill paid in advance into equal shares starting at the bill month', ({
    assert,
  }) => {
    const bills = [fakeBill(1, 2026, 1, 1200)]

    const shares = expandUtilityBillsToMonthlyShares(bills, 'annual', true)

    assert.lengthOf(shares, 12)
    assert.deepEqual(
      [shares[0], shares[shares.length - 1]].map((s) => [s!.year, s!.month]),
      [
        [2026, 1],
        [2026, 12],
      ]
    )
    for (const share of shares) {
      assert.equal(share.amount, 100)
    }
    assert.deepEqual(
      shares.map((s) => s.isBillingMonth),
      [true, ...Array(11).fill(false)]
    )
  })

  test('a paid-in-advance period spanning a year boundary runs forward from the bill month', ({
    assert,
  }) => {
    const bills = [fakeBill(1, 2025, 11, 300)]

    const shares = expandUtilityBillsToMonthlyShares(bills, 'quarterly', true)

    assert.deepEqual(
      shares.map((s) => [s.year, s.month]),
      [
        [2025, 11],
        [2025, 12],
        [2026, 1],
      ]
    )
    assert.deepEqual(
      shares.map((s) => s.isBillingMonth),
      [true, false, false]
    )
  })
})

test.group('utilityDueDateFor', () => {
  test('returns null when the utility has no configured due offset', ({ assert }) => {
    const utility = fakeUtility('monthly', null)

    assert.isNull(utilityDueDateFor(utility, [], 2026, 2))
  })

  test('a monthly utility gets a due date every month, on the configured day of that month', ({
    assert,
  }) => {
    const utility = fakeUtility('monthly', 13)

    const result = utilityDueDateFor(utility, [], 2026, 1)

    assert.equal(result?.toISO(), '2026-01-13T00:00:00.000Z')
  })

  test('clamps the due day to the last day of a shorter month (Water: 28 days, Feb)', ({
    assert,
  }) => {
    const utility = fakeUtility('monthly', 30)

    const result = utilityDueDateFor(utility, [], 2026, 2)

    assert.equal(result?.toISO(), '2026-02-28T00:00:00.000Z')
  })

  test('treats a configured day of 0 as day 1', ({ assert }) => {
    const utility = fakeUtility('monthly', 0)

    const result = utilityDueDateFor(utility, [], 2026, 1)

    assert.equal(result?.toISO(), '2026-01-01T00:00:00.000Z')
  })

  test('a quarterly utility only shows a due date in months aligned to its last bill', ({
    assert,
  }) => {
    const utility = fakeUtility('quarterly', 14)
    const bills = [fakeBill(1, 2026, 1, 100)]

    // Same month as the anchor bill - due.
    assert.isNotNull(utilityDueDateFor(utility, bills, 2026, 1))
    // 3 months later (one quarter on) - due again.
    assert.isNotNull(utilityDueDateFor(utility, bills, 2026, 4))
    // 1 or 2 months off the quarterly cadence - not due.
    assert.isNull(utilityDueDateFor(utility, bills, 2026, 2))
    assert.isNull(utilityDueDateFor(utility, bills, 2026, 3))
  })

  test('a quarterly utility with no bills yet is not restricted by cadence', ({ assert }) => {
    const utility = fakeUtility('quarterly', 14)

    assert.isNotNull(utilityDueDateFor(utility, [], 2026, 2))
  })

  test('an unrecognized frequency falls back to a period of 1 month (due every month)', ({
    assert,
  }) => {
    const utility = fakeUtility('fortnightly', 5)
    const bills = [fakeBill(1, 2026, 1, 100)]

    assert.isNotNull(utilityDueDateFor(utility, bills, 2026, 2))
    assert.isNotNull(utilityDueDateFor(utility, bills, 2026, 3))
  })
})

test.group('nextUtilityDueDate', () => {
  test('returns null when the utility has no configured due offset', ({ assert }) => {
    const utility = fakeUtility('monthly', null)

    assert.isNull(nextUtilityDueDate(utility, [], DateTime.utc(2026, 3, 1)))
  })

  test("returns this month's due date when it hasn't passed yet", ({ assert }) => {
    const utility = fakeUtility('monthly', 20)

    const result = nextUtilityDueDate(utility, [], DateTime.utc(2026, 3, 10))

    assert.equal(result?.toISO(), '2026-03-20T00:00:00.000Z')
  })

  test('rolls forward to next month once this month is already past its due day', ({ assert }) => {
    const utility = fakeUtility('monthly', 5)

    const result = nextUtilityDueDate(utility, [], DateTime.utc(2026, 3, 10))

    assert.equal(result?.toISO(), '2026-04-05T00:00:00.000Z')
  })

  test('a quarterly utility skips ahead to its next actual billing month', ({ assert }) => {
    const utility = fakeUtility('quarterly', 14)
    const bills = [fakeBill(1, 2026, 1, 300)]

    // February and March aren't billing months for a Jan-anchored quarterly
    // utility - the next one is April.
    const result = nextUtilityDueDate(utility, bills, DateTime.utc(2026, 2, 1))

    assert.equal(result?.toISO(), '2026-04-14T00:00:00.000Z')
  })

  test('an annual utility due date that already passed this cycle rolls to next year', ({
    assert,
  }) => {
    const utility = fakeUtility('annual', 7)
    const bills = [fakeBill(1, 2025, 6, 1200)]

    // Anchored on June - due on the 7th, but "today" is already past that.
    const result = nextUtilityDueDate(utility, bills, DateTime.utc(2026, 6, 20))

    assert.equal(result?.toISO(), '2027-06-07T00:00:00.000Z')
  })
})
