import { test } from '@japa/runner'
import {
  createExpenseActualValidator,
  updateExpenseActualValidator,
} from '#validators/expense_monthly_actual'

test.group('createExpenseActualValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await createExpenseActualValidator.validate({
      occurredOn: '2026-02-01',
      amount: 120.5,
    })
    assert.equal(payload.amount, 120.5)
    assert.equal(payload.occurredOn.toISODate(), '2026-02-01')
  })

  test('rejects a missing occurredOn', async ({ assert }) => {
    await assert.rejects(() => createExpenseActualValidator.validate({ amount: 10 }))
  })

  test('rejects an unparseable occurredOn', async ({ assert }) => {
    await assert.rejects(() =>
      createExpenseActualValidator.validate({ occurredOn: 'not-a-date', amount: 10 })
    )
  })

  test('rejects a negative amount', async ({ assert }) => {
    await assert.rejects(() =>
      createExpenseActualValidator.validate({ occurredOn: '2026-02-01', amount: -1 })
    )
  })
})

test.group('updateExpenseActualValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateExpenseActualValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('rejects a negative amount when provided', async ({ assert }) => {
    await assert.rejects(() => updateExpenseActualValidator.validate({ amount: -1 }))
  })
})
