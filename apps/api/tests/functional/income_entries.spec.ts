import { test } from '@japa/runner'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import { currentFinancialYear, financialYearMonths } from '#services/financial_year'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('IncomeEntries / index', () => {
  test('lists entries ordered by year then month', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await IncomeEntry.create({ userId: adam.id, year: 2026, month: 3, amount: 100 })
    await IncomeEntry.create({ userId: adam.id, year: 2026, month: 1, amount: 200 })

    const response = await client.get('/api/income-entries').loginAs(adam)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((e: { month: number }) => e.month),
      [1, 3]
    )
  })

  test('filters by year, month and userId', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const eve = await User.findByOrFail('fullName', 'Eve')
    await IncomeEntry.create({ userId: adam.id, year: 2026, month: 2, amount: 100 })
    await IncomeEntry.create({ userId: eve.id, year: 2026, month: 2, amount: 200 })
    await IncomeEntry.create({ userId: adam.id, year: 2026, month: 3, amount: 300 })

    const response = await client
      .get('/api/income-entries')
      .qs({ year: 2026, month: 2, userId: adam.id })
      .loginAs(adam)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].amount, 100)
  })

  test('filters by financialYear across the calendar-year boundary', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const financialYear = currentFinancialYear()
    const months = financialYearMonths(financialYear)
    const [firstMonth, lastMonth] = [months[0]!, months[11]!]
    await IncomeEntry.create({
      userId: adam.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 111,
    })
    await IncomeEntry.create({
      userId: adam.id,
      year: lastMonth.year,
      month: lastMonth.month,
      amount: 222,
    })
    // A year outside this financial year - should never come back.
    await IncomeEntry.create({
      userId: adam.id,
      year: firstMonth.year - 5,
      month: firstMonth.month,
      amount: 999,
    })

    const response = await client
      .get('/api/income-entries')
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)

    response.assertStatus(200)
    assert.sameMembers(
      response.body().data.map((e: { amount: number }) => e.amount),
      [111, 222]
    )
  })
})

test.group('IncomeEntries / store', () => {
  test('creates an unattributed entry attributed to a person', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/income-entries')
      .withCsrfToken()
      .loginAs(adam)
      .json({ year: 2026, month: 2, amount: 500, userId: adam.id, taxWithheld: false })

    response.assertStatus(201)
    assert.isNull(response.body().data.incomeSourceId)
    assert.equal(response.body().data.userId, adam.id)
    assert.equal(response.body().data.taxWithheld, false)
  })

  test('rejects an unattributed entry with no incomeSourceId or userId', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/income-entries')
      .withCsrfToken()
      .loginAs(adam)
      .json({ year: 2026, month: 2, amount: 500 })

    response.assertStatus(422)
  })

  test('creates an entry linked to an income source', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const source = await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
    })

    const response = await client
      .post('/api/income-entries')
      .withCsrfToken()
      .loginAs(adam)
      .json({ incomeSourceId: source.id, year: 2026, month: 2, amount: 5000 })

    response.assertStatus(201)
    assert.equal(response.body().data.incomeSourceId, source.id)
  })
})

test.group('IncomeEntries / update', () => {
  test('updates an entry', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const entry = await IncomeEntry.create({
      userId: adam.id,
      year: 2026,
      month: 2,
      amount: 500,
    })

    const response = await client
      .patch(`/api/income-entries/${entry.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 600 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 600)
  })
})

test.group('IncomeEntries / destroy', () => {
  test('deletes an entry', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const entry = await IncomeEntry.create({
      userId: adam.id,
      year: 2026,
      month: 2,
      amount: 500,
    })

    const response = await client
      .delete(`/api/income-entries/${entry.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    const remaining = await IncomeEntry.query().where('id', entry.id)
    assert.lengthOf(remaining, 0)
  })
})
