import { test } from '@japa/runner'
import User from '#models/user'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import RecurringBill from '#models/recurring_bill'

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

  test('excludes paused and archived categories by default, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const paused = await Category.create({ name: 'Paused Cat' })
    paused.isPaused = true
    await paused.save()
    const archived = await Category.create({ name: 'Archived Cat' })
    archived.isArchived = true
    await archived.save()

    const defaultResponse = await client.get('/api/categories').loginAs(brian)
    const defaultNames = defaultResponse.body().data.map((c: { name: string }) => c.name)
    assert.notInclude(defaultNames, 'Paused Cat')
    assert.notInclude(defaultNames, 'Archived Cat')

    const hiddenResponse = await client
      .get('/api/categories')
      .qs({ includeHidden: true })
      .loginAs(brian)
    const hiddenNames = hiddenResponse.body().data.map((c: { name: string }) => c.name)
    assert.include(hiddenNames, 'Paused Cat')
    assert.include(hiddenNames, 'Archived Cat')
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

  test('archiving a category clears an existing pause', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Kayo-like' })
    category.isPaused = true
    await category.save()

    const response = await client
      .patch(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ isArchived: true })

    response.assertStatus(200)
    assert.equal(response.body().data.isArchived, true)
    assert.equal(response.body().data.isPaused, false)
  })
})

test.group('Categories / destroy', () => {
  test('rejects removing a category that is not archived', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Temp' })

    const response = await client
      .delete(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(409)
    assert.isNotNull(await Category.find(category.id))
  })

  test('permanently deletes an archived category and its dependents', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Temp' })
    category.isArchived = true
    await category.save()
    await CategoryBudgetItem.create({ categoryId: category.id, name: 'Line', amount: 10 })
    await CategoryMonthlyActual.create({
      categoryId: category.id,
      occurredOn: '2026-01-01',
      amount: 50,
    })
    const bill = await RecurringBill.create({
      name: 'Linked Bill',
      categoryId: category.id,
      amount: 10,
      frequency: 'monthly',
    })

    const response = await client
      .delete(`/api/categories/${category.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    assert.isNull(await Category.find(category.id))
    assert.lengthOf(await CategoryBudgetItem.query().where('categoryId', category.id), 0)
    assert.lengthOf(await CategoryMonthlyActual.query().where('categoryId', category.id), 0)
    await bill.refresh()
    assert.isNull(bill.categoryId)
  })
})
