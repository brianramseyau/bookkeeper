import { test } from '@japa/runner'
import User from '#models/user'
import IncomeTaxSetting from '#models/income_tax_setting'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('IncomeTaxSettings / show', () => {
  test('returns null marginalRate when no setting exists yet', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .get('/api/income-tax-settings')
      .qs({ userId: adam.id, financialYear: 2026 })
      .loginAs(adam)

    response.assertStatus(200)
    assert.isNull(response.body().marginalRate)
  })

  test('returns the stored marginalRate for that user and financial year', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    await IncomeTaxSetting.create({ userId: adam.id, financialYear: 2026, marginalRate: 0.37 })

    const response = await client
      .get('/api/income-tax-settings')
      .qs({ userId: adam.id, financialYear: 2026 })
      .loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().marginalRate, 0.37)
  })
})

test.group('IncomeTaxSettings / upsert', () => {
  test('creates a setting when none exists', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/income-tax-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ userId: adam.id, financialYear: 2026, marginalRate: 0.37 })

    response.assertStatus(200)
    assert.equal(response.body().marginalRate, 0.37)
    const stored = await IncomeTaxSetting.query()
      .where('userId', adam.id)
      .where('financialYear', 2026)
      .firstOrFail()
    assert.equal(stored.marginalRate, 0.37)
  })

  test('updates the existing setting for that user and financial year', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    await IncomeTaxSetting.create({ userId: adam.id, financialYear: 2026, marginalRate: 0.32 })

    const response = await client
      .put('/api/income-tax-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ userId: adam.id, financialYear: 2026, marginalRate: 0.37 })

    response.assertStatus(200)
    const settings = await IncomeTaxSetting.query()
      .where('userId', adam.id)
      .where('financialYear', 2026)
    assert.lengthOf(settings, 1)
    assert.equal(settings[0]!.marginalRate, 0.37)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/income-tax-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ userId: adam.id, financialYear: 2026, marginalRate: 1.5 })

    response.assertStatus(422)
  })
})
