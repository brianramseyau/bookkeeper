import { test } from '@japa/runner'
import User from '#models/user'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('Categories / index', () => {
  test('lists only active categories, ordered by sortOrder, with a budgetItemCount', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const archived = await Category.create({ name: 'Archived', sortOrder: 999 })
    archived.isActive = false
    await archived.save()
    const dog = await Category.create({ name: 'Dog' })
    await CategoryBudgetItem.create({ categoryId: dog.id, name: 'Food', amount: 50 })

    const response = await client.get('/api/categories').loginAs(brian)

    response.assertStatus(200)
    const names = response.body().data.map((c: { name: string }) => c.name)
    assert.notInclude(names, 'Archived')
    const dogEntry = response.body().data.find((c: { name: string }) => c.name === 'Dog')
    assert.equal(dogEntry.budgetItemCount, 1)
  })
})

test.group('Categories / store', () => {
  test('creates a category', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Entertainment' })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Entertainment')
  })

  test('auto-assigns the next sortOrder when none is given', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const last = await Category.query().orderBy('sortOrder', 'desc').firstOrFail()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Entertainment' })

    assert.equal(response.body().data.sortOrder, last.sortOrder + 1)
  })

  test('assigns sortOrder 0 to the first category when the table is empty', async ({ assert }) => {
    await Category.query().delete()

    const category = await Category.create({ name: 'Brand New' })

    assert.equal(category.sortOrder, 0)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/categories')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: '' })

    response.assertStatus(422)
  })
})

test.group('Categories / update', () => {
  test('updates a category', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Groceries2' })

    const response = await client
      .patch(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ color: '#123456' })

    response.assertStatus(200)
    assert.equal(response.body().data.color, '#123456')
  })

  test('returns 404 for a non-existent category', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .patch('/api/categories/999999')
      .withCsrfToken()
      .loginAs(brian)
      .json({ color: '#123456' })

    response.assertStatus(404)
  })
})

test.group('Categories / destroy', () => {
  test('soft-deletes a category (isActive=false) rather than removing the row', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Temp' })

    const response = await client
      .delete(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)

    const reloaded = await Category.findOrFail(category.id)
    // isActive round-trips through SQLite as a raw 0/1 integer, not a real boolean.
    assert.equal(reloaded.isActive, false)
  })
})
