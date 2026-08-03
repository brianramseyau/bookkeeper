import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Expense from '#models/expense'
import ExpenseBudgetItem from '#models/expense_budget_item'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import ExpensePayment from '#models/expense_payment'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('Expenses / index', () => {
  test('lists only active expenses, ordered by sortOrder, with a budgetItemCount', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const archived = await Expense.create({ name: 'Archived', sortOrder: 999 })
    archived.isActive = false
    await archived.save()
    const dog = await Expense.create({ name: 'Dog' })
    await ExpenseBudgetItem.create({ expenseId: dog.id, name: 'Food', amount: 50 })

    const response = await client.get('/api/expenses').loginAs(adam)

    response.assertStatus(200)
    const names = response.body().data.map((c: { name: string }) => c.name)
    assert.notInclude(names, 'Archived')
    const dogEntry = response.body().data.find((c: { name: string }) => c.name === 'Dog')
    assert.equal(dogEntry.budgetItemCount, 1)
  })

  test('excludes paused and archived expenses by default, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const paused = await Expense.create({ name: 'Paused Exp' })
    paused.isPaused = true
    await paused.save()
    const archived = await Expense.create({ name: 'Archived Exp' })
    archived.isArchived = true
    await archived.save()

    const defaultResponse = await client.get('/api/expenses').loginAs(adam)
    const defaultNames = defaultResponse.body().data.map((c: { name: string }) => c.name)
    assert.notInclude(defaultNames, 'Paused Exp')
    assert.notInclude(defaultNames, 'Archived Exp')

    const hiddenResponse = await client
      .get('/api/expenses')
      .qs({ includeHidden: true })
      .loginAs(adam)
    const hiddenNames = hiddenResponse.body().data.map((c: { name: string }) => c.name)
    assert.include(hiddenNames, 'Paused Exp')
    assert.include(hiddenNames, 'Archived Exp')
  })
})

test.group('Expenses / store', () => {
  test('creates an expense', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/expenses')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Entertainment' })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Entertainment')
  })

  test('auto-assigns the next sortOrder when none is given', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await Expense.create({ name: 'Existing', sortOrder: 5 })
    const last = await Expense.query().orderBy('sortOrder', 'desc').firstOrFail()

    const response = await client
      .post('/api/expenses')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Entertainment' })

    assert.equal(response.body().data.sortOrder, last.sortOrder + 1)
  })

  test('assigns sortOrder 0 to the first expense when the table is empty', async ({ assert }) => {
    await Expense.query().delete()

    const expense = await Expense.create({ name: 'Brand New' })

    assert.equal(expense.sortOrder, 0)
  })

  test('rejects an invalid payload', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/expenses')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: '' })

    response.assertStatus(422)
  })
})

test.group('Expenses / update', () => {
  test('updates an expense', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Groceries2' })

    const response = await client
      .patch(`/api/expenses/${expense.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Groceries3' })

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Groceries3')
  })

  test('returns 404 for a non-existent expense', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .patch('/api/expenses/999999')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Groceries3' })

    response.assertStatus(404)
  })

  test('archiving an expense clears an existing pause', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Kayo-like' })
    expense.isPaused = true
    await expense.save()

    const response = await client
      .patch(`/api/expenses/${expense.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ isArchived: true })

    response.assertStatus(200)
    assert.equal(response.body().data.isArchived, true)
    assert.equal(response.body().data.isPaused, false)
  })
})

test.group('Expenses / destroy', () => {
  test('rejects removing an expense that is not archived', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Temp' })

    const response = await client
      .delete(`/api/expenses/${expense.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(409)
    assert.isNotNull(await Expense.find(expense.id))
  })

  test('permanently deletes an archived expense and its dependents', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Temp' })
    expense.isArchived = true
    await expense.save()
    await ExpenseBudgetItem.create({ expenseId: expense.id, name: 'Line', amount: 10 })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-01-01'),
      amount: 50,
    })
    await ExpensePayment.create({ expenseId: expense.id, year: 2026, month: 1, paid: true })

    const response = await client
      .delete(`/api/expenses/${expense.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    assert.isNull(await Expense.find(expense.id))
    assert.lengthOf(await ExpenseBudgetItem.query().where('expenseId', expense.id), 0)
    assert.lengthOf(await ExpenseMonthlyActual.query().where('expenseId', expense.id), 0)
    assert.lengthOf(await ExpensePayment.query().where('expenseId', expense.id), 0)
  })
})

test.group('Expenses / upsertPayment', () => {
  test('creates a payment row marking the month paid', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Groceries3' })

    const response = await client
      .put(`/api/expenses/${expense.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paid)
    assert.equal(response.body().data.expenseId, expense.id)
  })

  test('updates the existing payment row for that month rather than duplicating it', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Groceries3' })
    await client
      .put(`/api/expenses/${expense.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    const response = await client
      .put(`/api/expenses/${expense.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: false })

    response.assertStatus(200)
    assert.isFalse(response.body().data.paid)
    const payments = await ExpensePayment.query().where('expenseId', expense.id)
    assert.lengthOf(payments, 1)
  })

  test('returns 404 for a non-existent expense', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/expenses/999999/payments/2026/3')
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    response.assertStatus(404)
  })

  test('rejects a non-boolean paid value', async ({ client }) => {
    const adam = await loginAsAdam()
    const expense = await Expense.create({ name: 'Groceries3' })

    const response = await client
      .put(`/api/expenses/${expense.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: 'yes' })

    response.assertStatus(422)
  })
})
