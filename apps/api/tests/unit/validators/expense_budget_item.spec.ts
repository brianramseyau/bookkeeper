import { test } from '@japa/runner'
import {
  createExpenseBudgetItemValidator,
  updateExpenseBudgetItemValidator,
} from '#validators/expense_budget_item'

test.group('createExpenseBudgetItemValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await createExpenseBudgetItemValidator.validate({
      name: 'Dog food',
      amount: 45.5,
    })
    assert.equal(payload.name, 'Dog food')
    assert.equal(payload.amount, 45.5)
  })

  test('rejects a missing name', async ({ assert }) => {
    await assert.rejects(() => createExpenseBudgetItemValidator.validate({ amount: 10 }))
  })

  test('rejects a missing amount', async ({ assert }) => {
    await assert.rejects(() => createExpenseBudgetItemValidator.validate({ name: 'Vet' }))
  })

  test('rejects a negative amount', async ({ assert }) => {
    await assert.rejects(() =>
      createExpenseBudgetItemValidator.validate({ name: 'Vet', amount: -5 })
    )
  })

  test('allows a null notes field', async ({ assert }) => {
    const payload = await createExpenseBudgetItemValidator.validate({
      name: 'Vet',
      amount: 10,
      notes: null,
    })
    assert.isNull(payload.notes)
  })
})

test.group('updateExpenseBudgetItemValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateExpenseBudgetItemValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('rejects a negative amount when provided', async ({ assert }) => {
    await assert.rejects(() => updateExpenseBudgetItemValidator.validate({ amount: -1 }))
  })
})
