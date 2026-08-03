import { test } from '@japa/runner'
import User from '#models/user'
import Category from '#models/category'
import Expense from '#models/expense'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('Export / json', () => {
  test('exports every known table as a downloadable JSON document', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/export/json').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.header('content-type'), 'application/json')
    assert.include(response.header('content-disposition'), 'attachment')
    const body = JSON.parse(response.text())
    assert.isArray(body.categories)
    assert.isArray(body.expenses)
    assert.isArray(body.utilities)
    assert.isArray(body['utility-bills'])
    assert.isArray(body['recurring-bills'])
    assert.isArray(body.subscriptions)
    assert.isArray(body['expense-actuals'])
    assert.isArray(body['income-sources'])
    assert.isArray(body['income-entries'])
  })

  test('includes real row data', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/export/json').loginAs(adam)

    const body = JSON.parse(response.text())
    const names = body.categories.map((c: { name: string }) => c.name)
    assert.include(names, 'Groceries')
  })

  test('exports the lean category shape, with no budget fields', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/export/json').loginAs(adam)

    const body = JSON.parse(response.text())
    const groceries = body.categories.find((c: { name: string }) => c.name === 'Groceries')
    const keys = Object.keys(groceries)
    for (const key of ['id', 'name', 'color', 'sortOrder', 'isActive', 'isArchived']) {
      assert.include(keys, key)
    }
    for (const key of ['budgetAmount', 'isRecurring', 'excludeFromBudget', 'isPaused']) {
      assert.notInclude(keys, key)
    }
  })

  test('exports expenses with their budget fields', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await Expense.create({ name: 'Export Test Expense', budgetAmount: 250 })

    const response = await client.get('/api/export/json').loginAs(adam)

    const body = JSON.parse(response.text())
    const expense = body.expenses.find((e: { name: string }) => e.name === 'Export Test Expense')
    assert.isDefined(expense)
    assert.equal(expense.budgetAmount, 250)
    const keys = Object.keys(expense)
    for (const key of [
      'id',
      'name',
      'sortOrder',
      'budgetAmount',
      'isRecurring',
      'excludeFromBudget',
      'categoryId',
      'isActive',
      'isPaused',
      'isArchived',
    ]) {
      assert.include(keys, key)
    }
  })
})

test.group('Export / csv', () => {
  test('exports a known table as CSV with a header row', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/export/csv/categories').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.header('content-type'), 'text/csv; charset=utf-8')
    const lines = response.text().split('\n')
    assert.include(lines[0], 'name')
    assert.isTrue(lines.length > 1)
  })

  test('exports the expenses table as CSV too', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await Expense.create({ name: 'CSV Export Test' })

    const response = await client.get('/api/export/csv/expenses').loginAs(adam)

    response.assertStatus(200)
    assert.include(response.text(), 'CSV Export Test')
  })

  test('returns 404 for an unknown table', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/export/csv/not-a-real-table').loginAs(adam)

    response.assertStatus(404)
  })

  test('quotes CSV fields containing commas or quotes', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await Category.create({ name: 'Comma, Test' })

    const response = await client.get('/api/export/csv/categories').loginAs(adam)

    assert.include(response.text(), '"Comma, Test"')
  })

  test('collapses to a 204 for a table with no rows (empty CSV body)', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/export/csv/income-entries').loginAs(adam)

    // An empty string has nothing to send, so the framework collapses it to 204.
    response.assertStatus(204)
  })
})
