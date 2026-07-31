import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Expense from '#models/expense'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('ExpenseActuals / index', () => {
  test('lists all actuals for an expense ordered by date', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-03-01'),
      amount: 100,
    })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-01-01'),
      amount: 50,
    })

    const response = await client.get(`/api/expenses/${expense.id}/actuals`).loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((a: { amount: number }) => a.amount),
      [50, 100]
    )
  })

  test('filters by year and month when given', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-01-15'),
      amount: 50,
    })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-02-15'),
      amount: 75,
    })

    const response = await client
      .get(`/api/expenses/${expense.id}/actuals`)
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].amount, 75)
  })
})

test.group('ExpenseActuals / store', () => {
  test('creates an actual entry', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })

    const response = await client
      .post(`/api/expenses/${expense.id}/actuals`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ occurredOn: '2026-02-01', amount: 120.5, notes: 'Fuel' })

    response.assertStatus(201)
    assert.equal(response.body().data.amount, 120.5)
  })

  test('defaults notes to null when not given', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })

    const response = await client
      .post(`/api/expenses/${expense.id}/actuals`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ occurredOn: '2026-02-01', amount: 120.5 })

    response.assertStatus(201)
    assert.isNull(response.body().data.notes)
  })
})

test.group('ExpenseActuals / update', () => {
  test('updates an actual entry', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })
    const actual = await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-02-01'),
      amount: 100,
    })

    const response = await client
      .patch(`/api/expense-actuals/${actual.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 150 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 150)
  })
})

test.group('ExpenseActuals / destroy', () => {
  test('deletes an actual entry', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })
    const actual = await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-02-01'),
      amount: 100,
    })

    const response = await client
      .delete(`/api/expense-actuals/${actual.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const remaining = await ExpenseMonthlyActual.query().where('expenseId', expense.id)
    assert.lengthOf(remaining, 0)
  })
})

test.group('ExpenseActuals / trend', () => {
  test('returns a rolling-average trend for the expense', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const expense = await Expense.create({ name: 'Test Transport' })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-01-01'),
      amount: 100,
    })
    await ExpenseMonthlyActual.create({
      expenseId: expense.id,
      occurredOn: DateTime.fromISO('2026-02-01'),
      amount: 200,
    })

    const response = await client.get(`/api/expenses/${expense.id}/trend`).loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().average, 150)
    assert.equal(response.body().trend, 'up')
  })
})
