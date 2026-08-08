import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  compareByDaysUntilDue,
  isRecurringBillDueMonth,
  nextRecurringBillDueDate,
  recurringBillDueDateFor,
  recurringBillPeriodMonths,
} from '#services/recurring_bill_due_date'

test.group('recurringBillPeriodMonths', () => {
  test('maps each known frequency to its number of months', ({ assert }) => {
    assert.equal(recurringBillPeriodMonths('monthly'), 1)
    assert.equal(recurringBillPeriodMonths('quarterly'), 3)
    assert.equal(recurringBillPeriodMonths('biannual'), 6)
    assert.equal(recurringBillPeriodMonths('annual'), 12)
    assert.equal(recurringBillPeriodMonths('biennial'), 24)
    assert.equal(recurringBillPeriodMonths('triennial'), 36)
  })

  test('falls back to 1 for an unrecognized frequency', ({ assert }) => {
    assert.equal(recurringBillPeriodMonths('fortnightly'), 1)
  })
})

test.group('isRecurringBillDueMonth', () => {
  test('every month is a due month for a monthly bill', ({ assert }) => {
    assert.isTrue(isRecurringBillDueMonth('monthly', null, null, 2026, 3))
  })

  test('an annual bill is only due in its configured month, every year', ({ assert }) => {
    assert.isTrue(isRecurringBillDueMonth('annual', 7, null, 2026, 7))
    assert.isFalse(isRecurringBillDueMonth('annual', 7, null, 2026, 6))
    assert.isFalse(isRecurringBillDueMonth('annual', 7, null, 2026, 8))
  })

  test('a quarterly bill repeats every 3 months from its configured month', ({ assert }) => {
    assert.isTrue(isRecurringBillDueMonth('quarterly', 1, null, 2026, 1))
    assert.isTrue(isRecurringBillDueMonth('quarterly', 1, null, 2026, 4))
    assert.isTrue(isRecurringBillDueMonth('quarterly', 1, null, 2026, 10))
    assert.isFalse(isRecurringBillDueMonth('quarterly', 1, null, 2026, 2))
    assert.isFalse(isRecurringBillDueMonth('quarterly', 1, null, 2026, 3))
  })

  test('a biannual bill repeats every 6 months from its configured month', ({ assert }) => {
    assert.isTrue(isRecurringBillDueMonth('biannual', 5, null, 2026, 5))
    assert.isTrue(isRecurringBillDueMonth('biannual', 5, null, 2026, 11))
    assert.isFalse(isRecurringBillDueMonth('biannual', 5, null, 2026, 8))
  })

  test('is false with no configured due month for a non-monthly bill', ({ assert }) => {
    assert.isFalse(isRecurringBillDueMonth('annual', null, null, 2026, 7))
  })

  test('a triennial bill is only due every 3rd year from its anchor year', ({ assert }) => {
    assert.isTrue(isRecurringBillDueMonth('triennial', 6, 2026, 2026, 6))
    assert.isFalse(isRecurringBillDueMonth('triennial', 6, 2026, 2027, 6))
    assert.isFalse(isRecurringBillDueMonth('triennial', 6, 2026, 2028, 6))
    assert.isTrue(isRecurringBillDueMonth('triennial', 6, 2026, 2029, 6))
    assert.isFalse(isRecurringBillDueMonth('triennial', 6, 2026, 2029, 5))
  })

  test('a biennial bill is only due every 2nd year from its anchor year', ({ assert }) => {
    assert.isTrue(isRecurringBillDueMonth('biennial', 6, 2026, 2026, 6))
    assert.isFalse(isRecurringBillDueMonth('biennial', 6, 2026, 2027, 6))
    assert.isTrue(isRecurringBillDueMonth('biennial', 6, 2026, 2028, 6))
    assert.isFalse(isRecurringBillDueMonth('biennial', 6, 2026, 2028, 5))
  })

  test('without a dueYear, existing periods (which divide evenly into 12) are unaffected regardless of calendar year', ({
    assert,
  }) => {
    assert.isTrue(isRecurringBillDueMonth('annual', 7, null, 2030, 7))
    assert.isTrue(isRecurringBillDueMonth('quarterly', 1, null, 2030, 10))
  })
})

test.group('recurringBillDueDateFor', () => {
  test('returns null when dueDay is not set', ({ assert }) => {
    assert.isNull(recurringBillDueDateFor('monthly', null, null, null, 2026, 3))
  })

  test('a monthly bill gets a due date every month, on the configured day', ({ assert }) => {
    const result = recurringBillDueDateFor('monthly', 13, null, null, 2026, 1)

    assert.equal(result?.toISO(), '2026-01-13T00:00:00.000Z')
  })

  test('clamps the due day to the last day of a shorter month', ({ assert }) => {
    const result = recurringBillDueDateFor('monthly', 30, null, null, 2026, 2)

    assert.equal(result?.toISO(), '2026-02-28T00:00:00.000Z')
  })

  test('an annual bill only has a due date in its configured month', ({ assert }) => {
    assert.isNotNull(recurringBillDueDateFor('annual', 17, 7, null, 2026, 7))
    assert.isNotNull(recurringBillDueDateFor('annual', 17, 7, null, 2027, 7))
    assert.isNull(recurringBillDueDateFor('annual', 17, 7, null, 2026, 6))
  })

  test('a triennial bill only has a due date in its anchor year and cycle', ({ assert }) => {
    assert.isNotNull(recurringBillDueDateFor('triennial', 17, 7, 2026, 2026, 7))
    assert.isNull(recurringBillDueDateFor('triennial', 17, 7, 2026, 2027, 7))
    assert.isNotNull(recurringBillDueDateFor('triennial', 17, 7, 2026, 2029, 7))
  })
})

test.group('nextRecurringBillDueDate', () => {
  test('returns null when dueDay is not set', ({ assert }) => {
    assert.isNull(nextRecurringBillDueDate('monthly', null, null, null, DateTime.utc(2026, 3, 1)))
  })

  test("returns this month's due date when it hasn't passed yet", ({ assert }) => {
    const result = nextRecurringBillDueDate('monthly', 20, null, null, DateTime.utc(2026, 3, 10))

    assert.equal(result?.toISO(), '2026-03-20T00:00:00.000Z')
  })

  test('rolls forward to next month once this month is already past its due day', ({ assert }) => {
    const result = nextRecurringBillDueDate('monthly', 5, null, null, DateTime.utc(2026, 3, 10))

    assert.equal(result?.toISO(), '2026-04-05T00:00:00.000Z')
  })

  test('a quarterly bill skips ahead to its next actual due month', ({ assert }) => {
    const result = nextRecurringBillDueDate('quarterly', 14, 1, null, DateTime.utc(2026, 2, 1))

    assert.equal(result?.toISO(), '2026-04-14T00:00:00.000Z')
  })

  test('an annual bill due date that already passed this cycle rolls to next year', ({
    assert,
  }) => {
    const result = nextRecurringBillDueDate('annual', 7, 6, null, DateTime.utc(2026, 6, 20))

    assert.equal(result?.toISO(), '2027-06-07T00:00:00.000Z')
  })

  test('a triennial bill skips ahead to its next 3-year occurrence, not the next calendar year', ({
    assert,
  }) => {
    const result = nextRecurringBillDueDate('triennial', 15, 6, 2026, DateTime.utc(2027, 1, 1))

    assert.equal(result?.toISO(), '2029-06-15T00:00:00.000Z')
  })
})

test.group('compareByDaysUntilDue', () => {
  test('sorts soonest-first', ({ assert }) => {
    assert.isBelow(compareByDaysUntilDue(5, 10), 0)
    assert.isAbove(compareByDaysUntilDue(10, 5), 0)
    assert.equal(compareByDaysUntilDue(5, 5), 0)
  })

  test('pushes a null (no due date) after any real value', ({ assert }) => {
    assert.isAbove(compareByDaysUntilDue(null, 5), 0)
    assert.isBelow(compareByDaysUntilDue(5, null), 0)
  })

  test('treats two nulls as equal', ({ assert }) => {
    assert.equal(compareByDaysUntilDue(null, null), 0)
  })
})
