import { test } from '@japa/runner'
import User from '#models/user'
import MonthCarryover from '#models/month_carryover'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('MonthCarryovers / show', () => {
  test('returns an empty (204) response when no carryover is set for that month', async ({
    client,
  }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/month-carryovers/2026/2').loginAs(adam)

    // A JSON `null` body has nothing to send, so the framework collapses it to 204.
    response.assertStatus(204)
  })

  test('returns the carryover when one exists', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await MonthCarryover.create({ year: 2026, month: 2, amount: 1500.25 })

    const response = await client.get('/api/month-carryovers/2026/2').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 1500.25)
  })
})

test.group('MonthCarryovers / upsert', () => {
  test('creates a carryover for a month with none yet', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/month-carryovers/2026/2')
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 1500.25 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 1500.25)
  })

  test('updates the existing carryover rather than duplicating it', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await MonthCarryover.create({ year: 2026, month: 2, amount: 1000 })

    const response = await client
      .put('/api/month-carryovers/2026/2')
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 1500.25 })

    response.assertStatus(200)
    const all = await MonthCarryover.query().where('year', 2026).where('month', 2)
    assert.lengthOf(all, 1)
    assert.equal(all[0]!.amount, 1500.25)
  })
})
