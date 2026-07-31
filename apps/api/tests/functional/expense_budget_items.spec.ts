import { test } from '@japa/runner'
import User from '#models/user'
import Expense from '#models/expense'
import ExpenseBudgetItem from '#models/expense_budget_item'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('ExpenseBudgetItems / index', () => {
  test("lists an expense's budget items ordered by name", async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Dog' })
    await ExpenseBudgetItem.create({ expenseId: expense.id, name: 'Food', amount: 50 })
    await ExpenseBudgetItem.create({ expenseId: expense.id, name: 'Vet', amount: 100 })

    const response = await client.get(`/api/expenses/${expense.id}/budget-items`).loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((item: { name: string }) => item.name),
      ['Food', 'Vet']
    )
  })

  test('returns 404 for a non-existent expense', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/expenses/999999/budget-items').loginAs(brian)

    response.assertStatus(404)
  })
})

test.group('ExpenseBudgetItems / store', () => {
  test('creates an item and syncs the expense budgetAmount to the items total', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Dog' })

    await client
      .post(`/api/expenses/${expense.id}/budget-items`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Food', amount: 50 })
    const response = await client
      .post(`/api/expenses/${expense.id}/budget-items`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Vet', amount: 100 })

    response.assertStatus(201)
    const reloaded = await Expense.findOrFail(expense.id)
    assert.equal(reloaded.budgetAmount, 150)
  })
})

test.group('ExpenseBudgetItems / update', () => {
  test('updating an item amount re-syncs the expense budgetAmount', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Dog' })
    const item = await ExpenseBudgetItem.create({
      expenseId: expense.id,
      name: 'Food',
      amount: 50,
    })

    const response = await client
      .patch(`/api/expense-budget-items/${item.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 75 })

    response.assertStatus(200)
    const reloaded = await Expense.findOrFail(expense.id)
    assert.equal(reloaded.budgetAmount, 75)
  })
})

test.group('ExpenseBudgetItems / destroy', () => {
  test('deleting the last item clears the expense budgetAmount back to null', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Dog' })
    const item = await ExpenseBudgetItem.create({
      expenseId: expense.id,
      name: 'Food',
      amount: 50,
    })

    const response = await client
      .delete(`/api/expense-budget-items/${item.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const reloaded = await Expense.findOrFail(expense.id)
    assert.isNull(reloaded.budgetAmount)
  })

  test('deleting one of several items keeps budgetAmount synced to the remainder', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Dog' })
    const food = await ExpenseBudgetItem.create({
      expenseId: expense.id,
      name: 'Food',
      amount: 50,
    })
    await ExpenseBudgetItem.create({ expenseId: expense.id, name: 'Vet', amount: 100 })

    await client.delete(`/api/expense-budget-items/${food.id}`).withCsrfToken().loginAs(brian)

    const reloaded = await Expense.findOrFail(expense.id)
    assert.equal(reloaded.budgetAmount, 100)
  })
})
