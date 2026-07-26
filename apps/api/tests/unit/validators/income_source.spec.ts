import { test } from '@japa/runner'
import { createIncomeSourceValidator, updateIncomeSourceValidator } from '#validators/income_source'

test.group('createIncomeSourceValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await createIncomeSourceValidator.validate({
      userId: 1,
      name: 'Salary',
      expectedAmount: 5000,
    })
    assert.equal(payload.name, 'Salary')
  })

  test('rejects a missing userId', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({ name: 'Salary', expectedAmount: 5000 })
    )
  })

  test('rejects a non-positive userId', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({ userId: 0, name: 'Salary', expectedAmount: 5000 })
    )
  })

  test('rejects a negative expectedAmount', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({ userId: 1, name: 'Salary', expectedAmount: -1 })
    )
  })
})

test.group('updateIncomeSourceValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateIncomeSourceValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('accepts toggling isActive', async ({ assert }) => {
    const payload = await updateIncomeSourceValidator.validate({ isActive: false })
    assert.equal(payload.isActive, false)
  })
})
