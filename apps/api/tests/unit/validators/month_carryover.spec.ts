import { test } from '@japa/runner'
import { upsertMonthCarryoverValidator } from '#validators/month_carryover'

test.group('upsertMonthCarryoverValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await upsertMonthCarryoverValidator.validate({ amount: 1500.25 })
    assert.equal(payload.amount, 1500.25)
  })

  test('accepts a negative amount (overdrawn carryover)', async ({ assert }) => {
    const payload = await upsertMonthCarryoverValidator.validate({ amount: -200 })
    assert.equal(payload.amount, -200)
  })

  test('rejects a missing amount', async ({ assert }) => {
    await assert.rejects(() => upsertMonthCarryoverValidator.validate({}))
  })

  test('allows a null notes field', async ({ assert }) => {
    const payload = await upsertMonthCarryoverValidator.validate({ amount: 100, notes: null })
    assert.isNull(payload.notes)
  })
})
