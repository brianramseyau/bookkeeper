import { test } from '@japa/runner'
import User from '#models/user'
import IncomeSource from '#models/income_source'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('IncomeSources / index', () => {
  test('lists income sources ordered by name', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await IncomeSource.create({ userId: brian.id, name: 'Salary', expectedAmount: 5000 })
    await IncomeSource.create({ userId: brian.id, name: 'Freelance', expectedAmount: 500 })

    const response = await client.get('/api/income-sources').loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((s: { name: string }) => s.name),
      ['Freelance', 'Salary']
    )
  })

  test('filters by userId when given', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const ariel = await User.findByOrFail('fullName', 'Ariel')
    await IncomeSource.create({ userId: brian.id, name: 'Salary', expectedAmount: 5000 })
    await IncomeSource.create({ userId: ariel.id, name: 'Salary (Ariel)', expectedAmount: 4000 })

    const response = await client.get('/api/income-sources').qs({ userId: ariel.id }).loginAs(brian)

    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].name, 'Salary (Ariel)')
  })
})

test.group('IncomeSources / store', () => {
  test('creates an income source', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/income-sources')
      .withCsrfToken()
      .loginAs(brian)
      .json({ userId: brian.id, name: 'Salary', expectedAmount: 5000 })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Salary')
  })
})

test.group('IncomeSources / update', () => {
  test('updates an income source', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
    })

    const response = await client
      .patch(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ expectedAmount: 5500 })

    response.assertStatus(200)
    assert.equal(response.body().data.expectedAmount, 5500)
  })
})

test.group('IncomeSources / destroy', () => {
  test('soft-deletes an income source', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
    })

    const response = await client
      .delete(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const reloaded = await IncomeSource.findOrFail(source.id)
    assert.equal(reloaded.isActive, false)
  })
})
