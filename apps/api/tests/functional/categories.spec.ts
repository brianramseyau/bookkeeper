import { test } from '@japa/runner'
import User from '#models/user'
import Category from '#models/category'
import Expense from '#models/expense'
import RecurringBill from '#models/recurring_bill'
import UserSubscription from '#models/user_subscription'
import Utility from '#models/utility'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('Categories / index', () => {
  test('lists only active, non-archived categories, ordered by sortOrder', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const archived = await Category.create({ name: 'Archived', sortOrder: 999 })
    archived.isActive = false
    await archived.save()
    await Category.create({ name: 'Dog' })

    const response = await client.get('/api/categories').loginAs(adam)

    response.assertStatus(200)
    const names = response.body().data.map((c: { name: string }) => c.name)
    assert.notInclude(names, 'Archived')
    assert.include(names, 'Dog')
  })

  test('excludes archived categories by default, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const archived = await Category.create({ name: 'Archived Cat' })
    archived.isArchived = true
    await archived.save()

    const defaultResponse = await client.get('/api/categories').loginAs(adam)
    const defaultNames = defaultResponse.body().data.map((c: { name: string }) => c.name)
    assert.notInclude(defaultNames, 'Archived Cat')

    const hiddenResponse = await client
      .get('/api/categories')
      .qs({ includeHidden: true })
      .loginAs(adam)
    const hiddenNames = hiddenResponse.body().data.map((c: { name: string }) => c.name)
    assert.include(hiddenNames, 'Archived Cat')
  })
})

test.group('Categories / store', () => {
  test('creates a category', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Entertainment' })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Entertainment')
  })

  test('auto-assigns a color when none is given', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Entertainment' })

    assert.isString(response.body().data.color)
  })

  test('keeps an explicitly given color instead of auto-assigning one', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Entertainment', color: '#123456' })

    assert.equal(response.body().data.color, '#123456')
  })

  test('auto-assigns the next sortOrder when none is given', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const last = await Category.query().orderBy('sortOrder', 'desc').firstOrFail()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Entertainment' })

    assert.equal(response.body().data.sortOrder, last.sortOrder + 1)
  })

  test('assigns sortOrder 0 to the first category when the table is empty', async ({ assert }) => {
    await Category.query().delete()

    const category = await Category.create({ name: 'Brand New' })

    assert.equal(category.sortOrder, 0)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: '' })

    response.assertStatus(422)
  })
})

test.group('Categories / update', () => {
  test('updates a category', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const category = await Category.create({ name: 'Groceries2' })

    const response = await client
      .patch(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ color: '#123456' })

    response.assertStatus(200)
    assert.equal(response.body().data.color, '#123456')
  })

  test('returns 404 for a non-existent category', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .patch('/api/categories/999999')
      .withCsrfToken()
      .loginAs(adam)
      .json({ color: '#123456' })

    response.assertStatus(404)
  })

  test('rejects renaming the system category', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utilities = await Category.findByOrFail('name', 'Utilities')
    assert.equal(utilities.isSystem, true)

    const response = await client
      .patch(`/api/categories/${utilities.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Renamed Utilities' })

    response.assertStatus(409)
    await utilities.refresh()
    assert.equal(utilities.name, 'Utilities')
  })

  test('rejects archiving the system category', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utilities = await Category.findByOrFail('name', 'Utilities')

    const response = await client
      .patch(`/api/categories/${utilities.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ isArchived: true })

    response.assertStatus(409)
    await utilities.refresh()
    assert.equal(utilities.isArchived, false)
  })

  test('allows changing the system category color and sortOrder', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utilities = await Category.findByOrFail('name', 'Utilities')

    const response = await client
      .patch(`/api/categories/${utilities.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ color: '#abcdef', sortOrder: 42 })

    response.assertStatus(200)
    assert.equal(response.body().data.color, '#abcdef')
    assert.equal(response.body().data.sortOrder, 42)
  })

  test('allows updating the system category when name is sent unchanged', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const utilities = await Category.findByOrFail('name', 'Utilities')

    const response = await client
      .patch(`/api/categories/${utilities.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Utilities', color: '#abcdef' })

    response.assertStatus(200)
    assert.equal(response.body().data.color, '#abcdef')
  })
})

test.group('Categories / destroy', () => {
  test('rejects removing a category that is not archived', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const category = await Category.create({ name: 'Temp' })

    const response = await client
      .delete(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(409)
    assert.isNotNull(await Category.find(category.id))
  })

  test('rejects removing the system category even when archived', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const utilities = await Category.findByOrFail('name', 'Utilities')

    const response = await client
      .delete(`/api/categories/${utilities.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(409)
    assert.isNotNull(await Category.find(utilities.id))
  })

  test('permanently deletes an archived category and clears dependents', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const category = await Category.create({ name: 'Temp' })
    category.isArchived = true
    await category.save()

    const bill = await RecurringBill.create({
      name: 'Linked Bill',
      categoryId: category.id,
      amount: 10,
      frequency: 'monthly',
    })
    const subscription = await UserSubscription.create({
      userId: adam.id,
      name: 'Linked Sub',
      categoryId: category.id,
      amount: 5,
    })
    const utility = await Utility.create({ name: 'Linked Utility', categoryId: category.id })
    const expense = await Expense.create({ name: 'Linked Expense', categoryId: category.id })

    const response = await client
      .delete(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    assert.isNull(await Category.find(category.id))
    await bill.refresh()
    assert.isNull(bill.categoryId)
    await subscription.refresh()
    assert.isNull(subscription.categoryId)
    await utility.refresh()
    assert.isNull(utility.categoryId)
    await expense.refresh()
    assert.isNull(expense.categoryId)
  })
})
