import { test } from '@japa/runner'
import User from '#models/user'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('CategoryBudgetItems / index', () => {
  test("lists a category's budget items ordered by name", async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Dog' })
    await CategoryBudgetItem.create({ categoryId: category.id, name: 'Food', amount: 50 })
    await CategoryBudgetItem.create({ categoryId: category.id, name: 'Vet', amount: 100 })

    const response = await client.get(`/api/categories/${category.id}/budget-items`).loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((item: { name: string }) => item.name),
      ['Food', 'Vet']
    )
  })

  test('returns 404 for a non-existent category', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/categories/999999/budget-items').loginAs(brian)

    response.assertStatus(404)
  })
})

test.group('CategoryBudgetItems / store', () => {
  test('creates an item and syncs the category budgetAmount to the items total', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Dog' })

    await client
      .post(`/api/categories/${category.id}/budget-items`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Food', amount: 50 })
    const response = await client
      .post(`/api/categories/${category.id}/budget-items`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Vet', amount: 100 })

    response.assertStatus(201)
    const reloaded = await Category.findOrFail(category.id)
    assert.equal(reloaded.budgetAmount, 150)
  })
})

test.group('CategoryBudgetItems / update', () => {
  test('updating an item amount re-syncs the category budgetAmount', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Dog' })
    const item = await CategoryBudgetItem.create({
      categoryId: category.id,
      name: 'Food',
      amount: 50,
    })

    const response = await client
      .patch(`/api/category-budget-items/${item.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 75 })

    response.assertStatus(200)
    const reloaded = await Category.findOrFail(category.id)
    assert.equal(reloaded.budgetAmount, 75)
  })
})

test.group('CategoryBudgetItems / destroy', () => {
  test('deleting the last item clears the category budgetAmount back to null', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Dog' })
    const item = await CategoryBudgetItem.create({
      categoryId: category.id,
      name: 'Food',
      amount: 50,
    })

    const response = await client
      .delete(`/api/category-budget-items/${item.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const reloaded = await Category.findOrFail(category.id)
    assert.isNull(reloaded.budgetAmount)
  })

  test('deleting one of several items keeps budgetAmount synced to the remainder', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const category = await Category.create({ name: 'Dog' })
    const food = await CategoryBudgetItem.create({
      categoryId: category.id,
      name: 'Food',
      amount: 50,
    })
    await CategoryBudgetItem.create({ categoryId: category.id, name: 'Vet', amount: 100 })

    await client.delete(`/api/category-budget-items/${food.id}`).withCsrfToken().loginAs(brian)

    const reloaded = await Category.findOrFail(category.id)
    assert.equal(reloaded.budgetAmount, 100)
  })
})
