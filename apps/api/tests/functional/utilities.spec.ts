import { test } from '@japa/runner'
import User from '#models/user'
import Utility from '#models/utility'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('Utilities / index', () => {
  test('lists utilities ordered by name', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await Utility.create({ name: 'Test Water' })
    await Utility.create({ name: 'Test Electricity' })

    const response = await client.get('/api/utilities').loginAs(brian)

    response.assertStatus(200)
    // Filtered to this test's own rows - the "Internet" utility from
    // internet_utility_actuals_seeder.ts is real seed data present in every
    // test run, not something this test should need to know about.
    const names = response
      .body()
      .data.map((u: { name: string }) => u.name)
      .filter((name: string) => name.startsWith('Test '))
    assert.deepEqual(names, ['Test Electricity', 'Test Water'])
  })
})

test.group('Utilities / store', () => {
  test('creates a utility with a default frequency', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Gas' })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Gas')
  })

  test('creates a Water-style quarterly utility with a due offset', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Water', frequency: 'quarterly', dueOffsetDays: 28 })

    response.assertStatus(201)
    assert.equal(response.body().data.frequency, 'quarterly')
    assert.equal(response.body().data.dueOffsetDays, 28)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: '' })

    response.assertStatus(422)
  })
})

test.group('Utilities / update', () => {
  test('updates a utility', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })

    const response = await client
      .patch(`/api/utilities/${utility.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ frequency: 'monthly', dueOffsetDays: 0 })

    response.assertStatus(200)
    assert.equal(response.body().data.dueOffsetDays, 0)
  })
})

test.group('Utilities / destroy', () => {
  test('soft-deletes a utility', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })

    const response = await client
      .delete(`/api/utilities/${utility.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const reloaded = await Utility.findOrFail(utility.id)
    assert.equal(reloaded.isActive, false)
  })
})
