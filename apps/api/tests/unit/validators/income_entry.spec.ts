import { test } from '@japa/runner'
import { createIncomeEntryValidator, updateIncomeEntryValidator } from '#validators/income_entry'

test.group('createIncomeEntryValidator', () => {
  test('accepts a minimal valid payload tied to an income source', async ({ assert }) => {
    const payload = await createIncomeEntryValidator.validate({
      year: 2026,
      month: 2,
      amount: 5000,
      incomeSourceId: 1,
    })
    assert.equal(payload.year, 2026)
    assert.equal(payload.month, 2)
  })

  test('accepts an unattributed entry with a userId', async ({ assert }) => {
    const payload = await createIncomeEntryValidator.validate({
      year: 2026,
      month: 2,
      amount: 100,
      incomeSourceId: null,
      userId: 1,
      taxWithheld: false,
    })
    assert.isNull(payload.incomeSourceId)
    assert.equal(payload.userId, 1)
    assert.equal(payload.taxWithheld, false)
  })

  test('rejects an unattributed entry with no incomeSourceId or userId', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeEntryValidator.validate({ year: 2026, month: 2, amount: 100 })
    )
  })

  test('rejects a month outside 1-12', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeEntryValidator.validate({ year: 2026, month: 13, amount: 100 })
    )
    await assert.rejects(() =>
      createIncomeEntryValidator.validate({ year: 2026, month: 0, amount: 100 })
    )
  })

  test('rejects a year outside 2000-2100', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeEntryValidator.validate({ year: 1999, month: 1, amount: 100 })
    )
  })

  test('rejects a negative amount', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeEntryValidator.validate({ year: 2026, month: 1, amount: -1 })
    )
  })

  test('rejects a non-positive incomeSourceId', async ({ assert }) => {
    await assert.rejects(() =>
      createIncomeEntryValidator.validate({
        year: 2026,
        month: 1,
        amount: 100,
        incomeSourceId: 0,
      })
    )
  })
})

test.group('updateIncomeEntryValidator', () => {
  test('accepts an empty payload', async ({ assert }) => {
    const payload = await updateIncomeEntryValidator.validate({})
    assert.deepEqual(payload, {})
  })

  test('rejects an out-of-range month when provided', async ({ assert }) => {
    await assert.rejects(() => updateIncomeEntryValidator.validate({ month: 15 }))
  })
})
