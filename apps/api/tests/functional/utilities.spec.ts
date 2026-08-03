import { test } from '@japa/runner'
import User from '#models/user'
import Category from '#models/category'
import Utility from '#models/utility'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('Utilities / index', () => {
  test('lists utilities ordered by name', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await Utility.create({ name: 'Test Water' })
    await Utility.create({ name: 'Test Electricity' })

    const response = await client.get('/api/utilities').loginAs(adam)

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
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Gas' })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Gas')
    assert.isFalse(response.body().data.paidInAdvance)
  })

  test('creates a Water-style quarterly utility with a due offset', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Water', frequency: 'quarterly', dueOffsetDays: 28 })

    response.assertStatus(201)
    assert.equal(response.body().data.frequency, 'quarterly')
    assert.equal(response.body().data.dueOffsetDays, 28)
  })

  test('creates a Phones-style annual utility paid in advance', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Phones', frequency: 'annual', paidInAdvance: true })

    response.assertStatus(201)
    assert.isTrue(response.body().data.paidInAdvance)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: '' })

    response.assertStatus(422)
  })

  test('always assigns the system Utilities category, ignoring any categoryId in the payload', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const utilitiesCategory = await Category.query()
      .where('name', 'Utilities')
      .andWhere('isSystem', true)
      .firstOrFail()
    const other = await Category.create({ name: 'Not Utilities' })

    const response = await client
      .post('/api/utilities')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Gas', categoryId: other.id })

    response.assertStatus(201)
    assert.equal(response.body().data.categoryId, utilitiesCategory.id)
  })
})

test.group('Utilities / update', () => {
  test('updates a utility', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utility = await Utility.create({ name: 'Electricity' })

    const response = await client
      .patch(`/api/utilities/${utility.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ frequency: 'monthly', dueOffsetDays: 0 })

    response.assertStatus(200)
    assert.equal(response.body().data.dueOffsetDays, 0)
  })

  test('ignores a categoryId in the update payload - it is not a settable field', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const utilitiesCategory = await Category.query()
      .where('name', 'Utilities')
      .andWhere('isSystem', true)
      .firstOrFail()
    const other = await Category.create({ name: 'Not Utilities Either' })
    const utility = await Utility.create({ name: 'Electricity', categoryId: utilitiesCategory.id })

    const response = await client
      .patch(`/api/utilities/${utility.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ categoryId: other.id })

    response.assertStatus(200)
    assert.equal(response.body().data.categoryId, utilitiesCategory.id)
  })

  test('toggles paidInAdvance', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utility = await Utility.create({ name: 'Phones', frequency: 'annual' })

    const response = await client
      .patch(`/api/utilities/${utility.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paidInAdvance: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paidInAdvance)
  })
})

test.group('Utilities / destroy', () => {
  test('soft-deletes a utility', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utility = await Utility.create({ name: 'Electricity' })

    const response = await client
      .delete(`/api/utilities/${utility.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    const reloaded = await Utility.findOrFail(utility.id)
    assert.equal(reloaded.isActive, false)
  })
})
