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

  test('accepts a received date', async ({ assert }) => {
    const payload = await upsertUtilityBillValidator.validate({
      amount: 100,
      receivedOn: '2026-01-15',
    })
    assert.equal(payload.receivedOn?.toISODate(), '2026-01-15')
  })

  test('allows a null received date', async ({ assert }) => {
    const payload = await upsertUtilityBillValidator.validate({ amount: 100, receivedOn: null })
    assert.isNull(payload.receivedOn)
  })

  test('rejects an invalid received date', async ({ assert }) => {
    await assert.rejects(() =>
      upsertUtilityBillValidator.validate({ amount: 100, receivedOn: 'not-a-date' })
    )
  })
})
