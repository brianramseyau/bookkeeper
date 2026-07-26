import { test } from '@japa/runner'
import { upsertUtilityBillValidator } from '#validators/utility_bill'

test.group('upsertUtilityBillValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await upsertUtilityBillValidator.validate({ amount: 409.08 })
    assert.equal(payload.amount, 409.08)
  })

  test('rejects a missing amount', async ({ assert }) => {
    await assert.rejects(() => upsertUtilityBillValidator.validate({}))
  })

  test('rejects a negative amount', async ({ assert }) => {
    await assert.rejects(() => upsertUtilityBillValidator.validate({ amount: -1 }))
  })

  test('allows a null notes field', async ({ assert }) => {
    const payload = await upsertUtilityBillValidator.validate({ amount: 100, notes: null })
    assert.isNull(payload.notes)
  })
})
