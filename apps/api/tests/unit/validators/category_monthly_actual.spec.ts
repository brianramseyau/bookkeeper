import { test } from '@japa/runner'
import {
  createCategoryActualValidator,
  updateCategoryActualValidator,
} from '#validators/category_monthly_actual'

test.group('createCategoryActualValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await createCategoryActualValidator.validate({
      occurredOn: '2026-02-01',
      amount: 120.5,
    })
    assert.equal(payload.amount, 120.5)
    assert.equal(payload.occurredOn.toISODate(), '2026-02-01')
  })

  test('rejects a missing occurredOn', async ({ assert }) => {
    await assert.rejects(() => createCategoryActualValidator.validate({ amount: 10 }))
  })

  test('rejects an unparseable occurredOn', async ({ assert }) => {
    await assert.rejects(() =>
      createCategoryActualValidator.validate({ occurredOn: 'not-a-date', amount: 10 })
    )
  })

  test('rejects a negative amount', async ({ assert }) => {
    await assert.rejects(() =>
      createCategoryActualValidator.validate({ occurredOn: '2026-02-01', amount: -1 })
    )
  })
})

test.group('updateCategoryActualValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateCategoryActualValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('rejects a negative amount when provided', async ({ assert }) => {
    await assert.rejects(() => updateCategoryActualValidator.validate({ amount: -1 }))
  })
})
