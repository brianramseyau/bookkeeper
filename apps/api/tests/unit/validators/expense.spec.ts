import { test } from '@japa/runner'
import { createExpenseValidator, updateExpenseValidator } from '#validators/expense'

test.group('createExpenseValidator', () => {
  test('accepts a minimal valid payload', async ({ assert }) => {
    const payload = await createExpenseValidator.validate({ name: 'Groceries' })
    assert.equal(payload.name, 'Groceries')
  })

  test('accepts a full payload with all optional fields', async ({ assert }) => {
    const payload = await createExpenseValidator.validate({
      name: 'Groceries',
      color: '#ff0000',
      sortOrder: 3,
      budgetAmount: 500,
      includeInStandardMonth: false,
      categoryId: 7,
    })
    assert.equal(payload.budgetAmount, 500)
    assert.equal(payload.includeInStandardMonth, false)
    assert.equal(payload.categoryId, 7)
  })

  test('trims the name', async ({ assert }) => {
    const payload = await createExpenseValidator.validate({ name: '  Groceries  ' })
    assert.equal(payload.name, 'Groceries')
  })

  test('rejects a missing name', async ({ assert }) => {
    await assert.rejects(() => createExpenseValidator.validate({}))
  })

  test('rejects an empty name', async ({ assert }) => {
    await assert.rejects(() => createExpenseValidator.validate({ name: '' }))
  })

  test('rejects a name over 80 characters', async ({ assert }) => {
    await assert.rejects(() => createExpenseValidator.validate({ name: 'a'.repeat(81) }))
  })

  test('rejects a negative budgetAmount', async ({ assert }) => {
    await assert.rejects(() =>
      createExpenseValidator.validate({ name: 'Groceries', budgetAmount: -1 })
    )
  })

  test('allows a null budgetAmount', async ({ assert }) => {
    const payload = await createExpenseValidator.validate({
      name: 'Groceries',
      budgetAmount: null,
    })
    assert.isNull(payload.budgetAmount)
  })

  test('allows a null categoryId', async ({ assert }) => {
    const payload = await createExpenseValidator.validate({
      name: 'Groceries',
      categoryId: null,
    })
    assert.isNull(payload.categoryId)
  })

  test('rejects a non-positive categoryId', async ({ assert }) => {
    await assert.rejects(() =>
      createExpenseValidator.validate({ name: 'Groceries', categoryId: 0 })
    )
    await assert.rejects(() =>
      createExpenseValidator.validate({ name: 'Groceries', categoryId: -1 })
    )
  })
})

test.group('updateExpenseValidator', () => {
  test('accepts an empty payload (all fields optional)', async ({ assert }) => {
    const payload = await updateExpenseValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('accepts isActive toggling', async ({ assert }) => {
    const payload = await updateExpenseValidator.validate({ isActive: false })
    assert.equal(payload.isActive, false)
  })

  test('accepts a categoryId', async ({ assert }) => {
    const payload = await updateExpenseValidator.validate({ categoryId: 3 })
    assert.equal(payload.categoryId, 3)
  })

  test('rejects an empty-string name when provided', async ({ assert }) => {
    await assert.rejects(() => updateExpenseValidator.validate({ name: '' }))
  })
})
