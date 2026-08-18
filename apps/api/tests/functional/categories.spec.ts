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

  test('returns parentId and nests children immediately after their parent', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Nesting Parent' })
    await Category.create({ name: 'Nesting Child 1', parentId: parent.id })
    await Category.create({ name: 'Nesting Child 2', parentId: parent.id })

    const response = await client.get('/api/categories').loginAs(adam)

    response.assertStatus(200)
    const data = response.body().data as {
      name: string
      parentId: number | null
      sortOrder: number
    }[]
    const child2Entry = data.find((c) => c.name === 'Nesting Child 2')
    assert.equal(child2Entry?.parentId, parent.id)

    const names = data.map((c) => c.name)
    const parentIndex = names.indexOf('Nesting Parent')
    assert.equal(names.indexOf('Nesting Child 1'), parentIndex + 1)
    assert.equal(names.indexOf('Nesting Child 2'), parentIndex + 2)
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

  test('creates a child category when parentId is given, scoping its sortOrder', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Child Parent' })

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Child Cat', parentId: parent.id })

    response.assertStatus(201)
    assert.equal(response.body().data.parentId, parent.id)
    assert.equal(response.body().data.sortOrder, 0)
  })

  test('rejects a parent that does not exist', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Orphan', parentId: 999999 })

    response.assertStatus(409)
  })

  test('rejects a child category as a parent (one level only)', async ({ client }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Child Parent 2' })
    const child = await Category.create({ name: 'Already A Child', parentId: parent.id })

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Grandchild', parentId: child.id })

    response.assertStatus(409)
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

  test('moves a category under a parent', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Move Parent' })
    const category = await Category.create({ name: 'Move Target' })

    const response = await client
      .patch(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ parentId: parent.id })

    response.assertStatus(200)
    assert.equal(response.body().data.parentId, parent.id)
  })

  test('promotes a child back to top-level with a null parentId', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Promote Parent' })
    const child = await Category.create({ name: 'Promote Target', parentId: parent.id })

    const response = await client
      .patch(`/api/categories/${child.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ parentId: null })

    response.assertStatus(200)
    assert.isNull(response.body().data.parentId)
  })

  test('rejects making a category its own parent', async ({ client }) => {
    const adam = await loginAsAdam()
    const category = await Category.create({ name: 'Self Parent' })

    const response = await client
      .patch(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ parentId: category.id })

    response.assertStatus(409)
  })

  test('rejects demoting a category that has children', async ({ client }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Grandchild Parent' })
    const child = await Category.create({ name: 'Has Children' })
    await Category.create({ name: 'Grandchild-ish', parentId: child.id })

    const response = await client
      .patch(`/api/categories/${child.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ parentId: parent.id })

    response.assertStatus(409)
  })

  test('rejects a child category as a parent on update too', async ({ client }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Grandchild Parent 2' })
    const child = await Category.create({ name: 'Nested Child', parentId: parent.id })
    const category = await Category.create({ name: 'Would-Be Grandchild' })

    const response = await client
      .patch(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ parentId: child.id })

    response.assertStatus(409)
  })

  test('archiving a parent archives its children too', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Cascade Parent' })
    const child = await Category.create({ name: 'Cascade Child', parentId: parent.id })

    const response = await client
      .patch(`/api/categories/${parent.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ isArchived: true })

    response.assertStatus(200)
    await parent.refresh()
    await child.refresh()
    assert.equal(parent.isArchived, true)
    assert.equal(child.isArchived, true)
  })

  test('unarchiving a parent unarchives its children too', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Cascade Parent 2' })
    const child = await Category.create({ name: 'Cascade Child 2', parentId: parent.id })
    parent.isArchived = true
    await parent.save()
    child.isArchived = true
    await child.save()

    const response = await client
      .patch(`/api/categories/${parent.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ isArchived: false })

    response.assertStatus(200)
    await parent.refresh()
    await child.refresh()
    assert.equal(parent.isArchived, false)
    assert.equal(child.isArchived, false)
  })

  test('unarchiving a child unarchives its parent too', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Cascade Parent 3' })
    const child = await Category.create({ name: 'Cascade Child 3', parentId: parent.id })
    parent.isArchived = true
    await parent.save()
    child.isArchived = true
    await child.save()

    const response = await client
      .patch(`/api/categories/${child.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ isArchived: false })

    response.assertStatus(200)
    await parent.refresh()
    await child.refresh()
    assert.equal(parent.isArchived, false)
    assert.equal(child.isArchived, false)
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

  test('deleting an archived parent deletes its children too', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const parent = await Category.create({ name: 'Destroy Parent' })
    const child = await Category.create({ name: 'Destroy Child', parentId: parent.id })
    parent.isArchived = true
    await parent.save()
    child.isArchived = true
    await child.save()

    const response = await client
      .delete(`/api/categories/${parent.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    assert.isNull(await Category.find(parent.id))
    assert.isNull(await Category.find(child.id))
  })
})
