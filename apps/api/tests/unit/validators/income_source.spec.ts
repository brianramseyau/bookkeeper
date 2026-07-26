import { test } from '@japa/runner'
import { createIncomeSourceValidator, updateIncomeSourceValidator } from '#validators/income_source'

test.group('createIncomeSourceValidator', () => {
  test('accepts a valid monthly payload', async ({ assert }) => {
    const payload = await createIncomeSourceValidator.validate({
      userId: 1,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    assert.equal(payload.name, 'Salary')
    assert.equal(payload.payDayOfMonth, 14)
  })

  test('accepts a valid fortnightly payload', async ({ assert }) => {
    const payload = await createIncomeSourceValidator.validate({
      userId: 1,
      name: 'Wages',
      expectedAmount: 2600,
      frequency: 'fortnightly',
      anchorDate: '2026-07-22',
    })
    assert.equal(payload.frequency, 'fortnightly')
  })

  test('accepts optional weekendRollback and taxWithheld', async ({ assert }) => {
    const payload = await createIncomeSourceValidator.validate({
      userId: 1,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
      weekendRollback: true,
      taxWithheld: false,
    })
    assert.equal(payload.weekendRollback, true)
    assert.equal(payload.taxWithheld, false)
  })

  test('rejects a missing userId', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({
        name: 'Salary',
        expectedAmount: 5000,
        frequency: 'monthly',
        payDayOfMonth: 14,
      })
    )
  })

  test('rejects a non-positive userId', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({
        userId: 0,
        name: 'Salary',
        expectedAmount: 5000,
        frequency: 'monthly',
        payDayOfMonth: 14,
      })
    )
  })

  test('rejects a negative expectedAmount', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({
        userId: 1,
        name: 'Salary',
        expectedAmount: -1,
        frequency: 'monthly',
        payDayOfMonth: 14,
      })
    )
  })

  test('rejects an invalid frequency', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({
        userId: 1,
        name: 'Salary',
        expectedAmount: 5000,
        frequency: 'weekly',
        payDayOfMonth: 14,
      })
    )
  })

  test('rejects a monthly frequency missing payDayOfMonth', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({
        userId: 1,
        name: 'Salary',
        expectedAmount: 5000,
        frequency: 'monthly',
      })
    )
  })

  test('rejects a fortnightly frequency missing anchorDate', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeSourceValidator.validate({
        userId: 1,
        name: 'Wages',
        expectedAmount: 2600,
        frequency: 'fortnightly',
      })
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

  test('accepts switching frequency and cadence fields', async ({ assert }) => {
    const payload = await updateIncomeSourceValidator.validate({
      frequency: 'fortnightly',
      anchorDate: '2026-07-22',
      payDayOfMonth: null,
    })
    assert.equal(payload.frequency, 'fortnightly')
    assert.isNull(payload.payDayOfMonth)
  })

  test('accepts toggling weekendRollback and taxWithheld', async ({ assert }) => {
    const payload = await updateIncomeSourceValidator.validate({
      weekendRollback: false,
      taxWithheld: false,
    })
    assert.equal(payload.weekendRollback, false)
    assert.equal(payload.taxWithheld, false)
  })
})
