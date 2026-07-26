import { test } from '@japa/runner'
import {
  createRecurringBillValidator,
  updateRecurringBillValidator,
} from '#validators/recurring_bill'

test.group('createRecurringBillValidator', () => {
  test('accepts a valid monthly bill', async ({ assert }) => {
    const payload = await createRecurringBillValidator.validate({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      nextDueOn: '2026-03-01',
    })
    assert.equal(payload.frequency, 'monthly')
  })

  test('rejects an invalid frequency', async ({ assert }) => {
    await assert.rejects(() =>
      createRecurringBillValidator.validate({
        name: 'Kayo',
        amount: 45.99,
        frequency: 'weekly',
        nextDueOn: '2026-03-01',
      })
    )
  })

  test('rejects a missing nextDueOn', async ({ assert }) => {
    await assert.rejects(() =>
      createRecurringBillValidator.validate({
        name: 'Kayo',
        amount: 45.99,
        frequency: 'monthly',
      })
    )
  })

  test('requires customIntervalValue and customIntervalUnit when frequency is custom', async ({
    assert,
  }) => {
    await assert.rejects(() =>
      createRecurringBillValidator.validate({
        name: 'Fortnightly thing',
        amount: 10,
        frequency: 'custom',
        nextDueOn: '2026-03-01',
      })
    )
  })

  test('accepts a custom frequency with its interval fields provided', async ({ assert }) => {
    const payload = await createRecurringBillValidator.validate({
      name: 'Fortnightly thing',
      amount: 10,
      frequency: 'custom',
      customIntervalValue: 2,
      customIntervalUnit: 'weeks',
      nextDueOn: '2026-03-01',
    })
    assert.equal(payload.customIntervalValue, 2)
    assert.equal(payload.customIntervalUnit, 'weeks')
  })

  test('does not require interval fields for a non-custom frequency', async ({ assert }) => {
    const payload = await createRecurringBillValidator.validate({
      name: 'Council Rates',
      amount: 2689.3,
      frequency: 'quarterly',
      nextDueOn: '2026-02-15',
    })
    assert.equal(payload.frequency, 'quarterly')
  })
})

test.group('updateRecurringBillValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateRecurringBillValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('rejects an invalid customIntervalUnit when provided', async ({ assert }) => {
    await assert.rejects(() =>
      updateRecurringBillValidator.validate({ customIntervalUnit: 'years' })
    )
  })
})
