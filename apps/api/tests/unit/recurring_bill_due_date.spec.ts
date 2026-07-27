import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { compareByDaysUntilDue, resolveNextOccurrence } from '#services/recurring_bill_due_date'

test.group('resolveNextOccurrence', () => {
  test('returns null when there is no nextDueOn', ({ assert }) => {
    const today = DateTime.fromISO('2026-07-27')

    assert.isNull(resolveNextOccurrence(null, 'monthly', null, null, today))
  })

  test('leaves a not-yet-due date unchanged', ({ assert }) => {
    const today = DateTime.fromISO('2026-07-27')
    const nextDueOn = today.plus({ days: 5 })

    const result = resolveNextOccurrence(nextDueOn, 'annual', null, null, today)

    assert.isTrue(result!.equals(nextDueOn))
  })

  test('rolls a monthly bill forward one month at a time', ({ assert }) => {
    const today = DateTime.fromISO('2026-07-27')
    const nextDueOn = today.minus({ months: 2, days: 3 })

    const result = resolveNextOccurrence(nextDueOn, 'monthly', null, null, today)

    assert.isTrue(result! >= today)
    assert.isTrue(result! < today.plus({ months: 1 }))
  })

  test('rolls a custom "days" bill forward by its interval', ({ assert }) => {
    const today = DateTime.fromISO('2026-07-27')
    const nextDueOn = today.minus({ days: 10 })

    const result = resolveNextOccurrence(nextDueOn, 'custom', 7, 'days', today)

    assert.isTrue(result!.equals(nextDueOn.plus({ days: 14 })))
  })

  test('rolls a custom "weeks" bill forward by its interval', ({ assert }) => {
    const today = DateTime.fromISO('2026-07-27')
    const nextDueOn = today.minus({ weeks: 3 })

    const result = resolveNextOccurrence(nextDueOn, 'custom', 2, 'weeks', today)

    assert.isTrue(result!.equals(nextDueOn.plus({ weeks: 4 })))
  })

  test('a custom bill with no stored interval falls back to 1 month', ({ assert }) => {
    const today = DateTime.fromISO('2026-07-27')
    const nextDueOn = today.minus({ months: 1, days: 5 })

    const result = resolveNextOccurrence(nextDueOn, 'custom', null, null, today)

    assert.isTrue(result!.equals(nextDueOn.plus({ months: 2 })))
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
