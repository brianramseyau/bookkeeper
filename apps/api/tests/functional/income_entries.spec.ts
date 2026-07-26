import { test } from '@japa/runner'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('IncomeEntries / index', () => {
  test('lists entries ordered by year then month', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await IncomeEntry.create({ userId: brian.id, year: 2026, month: 3, amount: 100 })
    await IncomeEntry.create({ userId: brian.id, year: 2026, month: 1, amount: 200 })

    const response = await client.get('/api/income-entries').loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((e: { month: number }) => e.month),
      [1, 3]
    )
  })

  test('filters by year, month and userId', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const ariel = await User.findByOrFail('fullName', 'Ariel')
    await IncomeEntry.create({ userId: brian.id, year: 2026, month: 2, amount: 100 })
    await IncomeEntry.create({ userId: ariel.id, year: 2026, month: 2, amount: 200 })
    await IncomeEntry.create({ userId: brian.id, year: 2026, month: 3, amount: 300 })

    const response = await client
      .get('/api/income-entries')
      .qs({ year: 2026, month: 2, userId: brian.id })
      .loginAs(brian)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].amount, 100)
  })
})

test.group('IncomeEntries / store', () => {
  test('creates an unattributed entry with no source or user', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/income-entries')
      .withCsrfToken()
      .loginAs(brian)
      .json({ year: 2026, month: 2, amount: 500 })

    response.assertStatus(201)
    assert.isNull(response.body().data.incomeSourceId)
  })

  test('creates an entry linked to an income source', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
    })

    const response = await client
      .post('/api/income-entries')
      .withCsrfToken()
      .loginAs(brian)
      .json({ incomeSourceId: source.id, year: 2026, month: 2, amount: 5000 })

    response.assertStatus(201)
    assert.equal(response.body().data.incomeSourceId, source.id)
  })
})

test.group('IncomeEntries / update', () => {
  test('updates an entry', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const entry = await IncomeEntry.create({
      userId: brian.id,
      year: 2026,
      month: 2,
      amount: 500,
    })

    const response = await client
      .patch(`/api/income-entries/${entry.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 600 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 600)
  })
})

test.group('IncomeEntries / destroy', () => {
  test('deletes an entry', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const entry = await IncomeEntry.create({
      userId: brian.id,
      year: 2026,
      month: 2,
      amount: 500,
    })

    const response = await client
      .delete(`/api/income-entries/${entry.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const remaining = await IncomeEntry.query().where('id', entry.id)
    assert.lengthOf(remaining, 0)
  })
})
