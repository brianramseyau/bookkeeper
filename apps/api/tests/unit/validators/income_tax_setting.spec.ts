import { test } from '@japa/runner'
import { upsertIncomeTaxSettingValidator } from '#validators/income_tax_setting'

test.group('upsertIncomeTaxSettingValidator', () => {
  test('accepts a valid payload', async ({ assert }) => {
    const payload = await upsertIncomeTaxSettingValidator.validate({
      userId: 1,
      financialYear: 2026,
      marginalRate: 0.37,
    })
    assert.equal(payload.userId, 1)
    assert.equal(payload.financialYear, 2026)
    assert.equal(payload.marginalRate, 0.37)
  })

  test('rejects a non-positive userId', async ({ assert }) => {
    await assert.rejects(() =>
      upsertIncomeTaxSettingValidator.validate({
        userId: 0,
        financialYear: 2026,
        marginalRate: 0.3,
      })
    )
  })

  test('rejects a financial year outside 2000-2100', async ({ assert }) => {
    await assert.rejects(() =>
      upsertIncomeTaxSettingValidator.validate({
        userId: 1,
        financialYear: 1999,
        marginalRate: 0.3,
      })
    )
  })

  test('rejects a marginal rate outside 0-1', async ({ assert }) => {
    await assert.rejects(() =>
      upsertIncomeTaxSettingValidator.validate({
        userId: 1,
        financialYear: 2026,
        marginalRate: 1.5,
      })
    )
    await assert.rejects(() =>
      upsertIncomeTaxSettingValidator.validate({
        userId: 1,
        financialYear: 2026,
        marginalRate: -0.1,
      })
    )
  })
})
