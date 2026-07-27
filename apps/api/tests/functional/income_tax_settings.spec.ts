import { test } from '@japa/runner'
import User from '#models/user'
import IncomeTaxSetting from '#models/income_tax_setting'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('IncomeTaxSettings / show', () => {
  test('returns null marginalRate when no setting exists yet', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .get('/api/income-tax-settings')
      .qs({ userId: brian.id, financialYear: 2026 })
      .loginAs(brian)

    response.assertStatus(200)
    assert.isNull(response.body().marginalRate)
  })

  test('returns the stored marginalRate for that user and financial year', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    await IncomeTaxSetting.create({ userId: brian.id, financialYear: 2026, marginalRate: 0.37 })

    const response = await client
      .get('/api/income-tax-settings')
      .qs({ userId: brian.id, financialYear: 2026 })
      .loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().marginalRate, 0.37)
  })
})

test.group('IncomeTaxSettings / upsert', () => {
  test('creates a setting when none exists', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/income-tax-settings')
      .withCsrfToken()
      .loginAs(brian)
      .json({ userId: brian.id, financialYear: 2026, marginalRate: 0.37 })

    response.assertStatus(200)
    assert.equal(response.body().marginalRate, 0.37)
    const stored = await IncomeTaxSetting.query()
      .where('userId', brian.id)
      .where('financialYear', 2026)
      .firstOrFail()
    assert.equal(stored.marginalRate, 0.37)
  })

  test('updates the existing setting for that user and financial year', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    await IncomeTaxSetting.create({ userId: brian.id, financialYear: 2026, marginalRate: 0.32 })

    const response = await client
      .put('/api/income-tax-settings')
      .withCsrfToken()
      .loginAs(brian)
      .json({ userId: brian.id, financialYear: 2026, marginalRate: 0.37 })

    response.assertStatus(200)
    const settings = await IncomeTaxSetting.query()
      .where('userId', brian.id)
      .where('financialYear', 2026)
    assert.lengthOf(settings, 1)
    assert.equal(settings[0]!.marginalRate, 0.37)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/income-tax-settings')
      .withCsrfToken()
      .loginAs(brian)
      .json({ userId: brian.id, financialYear: 2026, marginalRate: 1.5 })

    response.assertStatus(422)
  })
})
