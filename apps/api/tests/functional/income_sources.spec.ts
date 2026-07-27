import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import { currentFinancialYear, financialYearMonths } from '#services/financial_year'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('IncomeSources / index', () => {
  test('lists income sources ordered by name', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeSource.create({
      userId: brian.id,
      name: 'Freelance',
      expectedAmount: 500,
      frequency: 'monthly',
      payDayOfMonth: 1,
    })

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
    await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeSource.create({
      userId: ariel.id,
      name: 'Salary (Ariel)',
      expectedAmount: 4000,
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })

    const response = await client.get('/api/income-sources').qs({ userId: ariel.id }).loginAs(brian)

    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].name, 'Salary (Ariel)')
  })
})

test.group('IncomeSources / store', () => {
  test('creates a monthly income source with a pay day and weekend rollback', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const response = await client.post('/api/income-sources').withCsrfToken().loginAs(brian).json({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
      weekendRollback: true,
    })

    response.assertStatus(201)
    const body = response.body().data
    assert.equal(body.name, 'Salary')
    assert.equal(body.frequency, 'monthly')
    assert.equal(body.payDayOfMonth, 14)
    assert.equal(body.weekendRollback, true)
    assert.equal(body.taxWithheld, true)
  })

  test('creates a fortnightly income source anchored on a real payday', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const response = await client.post('/api/income-sources').withCsrfToken().loginAs(brian).json({
      userId: brian.id,
      name: 'Wages',
      expectedAmount: 2600,
      frequency: 'fortnightly',
      anchorDate: '2026-07-22',
      taxWithheld: false,
    })

    response.assertStatus(201)
    const body = response.body().data
    assert.equal(body.frequency, 'fortnightly')
    assert.isNotNull(body.anchorDate)
    assert.equal(body.taxWithheld, false)
  })

  test('rejects a monthly source missing a pay day', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/income-sources')
      .withCsrfToken()
      .loginAs(brian)
      .json({ userId: brian.id, name: 'Salary', expectedAmount: 5000, frequency: 'monthly' })

    response.assertStatus(422)
  })
})

test.group('IncomeSources / update', () => {
  test('updates an income source', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .patch(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ expectedAmount: 5500 })

    response.assertStatus(200)
    assert.equal(response.body().data.expectedAmount, 5500)
  })

  test('switches a source from monthly to fortnightly', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .patch(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ frequency: 'fortnightly', anchorDate: '2026-07-22', payDayOfMonth: null })

    response.assertStatus(200)
    assert.equal(response.body().data.frequency, 'fortnightly')
    assert.isNull(response.body().data.payDayOfMonth)
  })
})

test.group('IncomeSources / destroy', () => {
  test('soft-deletes an income source', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
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

test.group('IncomeSources / summary', () => {
  test("returns each user's monthly-equivalent income total and source count", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const ariel = await User.findByOrFail('fullName', 'Ariel')
    await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeSource.create({
      userId: ariel.id,
      name: 'Wages',
      expectedAmount: 2000,
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-01-07'),
    })

    const response = await client.get('/api/income-sources/summary').loginAs(brian)

    response.assertStatus(200)
    const brianSummary = response.body().data.find((s: { userId: number }) => s.userId === brian.id)
    const arielSummary = response.body().data.find((s: { userId: number }) => s.userId === ariel.id)
    assert.equal(brianSummary.total, 5000)
    assert.equal(brianSummary.count, 1)
    assert.equal(arielSummary.total, Math.round(((2000 * 26) / 12) * 100) / 100)
    assert.equal(arielSummary.count, 1)
  })

  test('excludes inactive sources from the total and count', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await IncomeSource.create({
      userId: brian.id,
      name: 'Old Job',
      expectedAmount: 1000,
      frequency: 'monthly',
      payDayOfMonth: 1,
      isActive: false,
    })

    const response = await client.get('/api/income-sources/summary').loginAs(brian)

    const brianSummary = response.body().data.find((s: { userId: number }) => s.userId === brian.id)
    assert.equal(brianSummary.total, 0)
    assert.equal(brianSummary.count, 0)
  })
})

test.group('IncomeSources / ytd', () => {
  test('sums actual income per month for a full past financial year, per source', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const financialYear = currentFinancialYear() - 1
    const months = financialYearMonths(financialYear)
    const [firstMonth, secondMonth] = months as [
      { year: number; month: number },
      { year: number; month: number },
    ]
    const source = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeEntry.create({
      incomeSourceId: source.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 4800,
    })
    await IncomeEntry.create({
      incomeSourceId: source.id,
      year: secondMonth.year,
      month: secondMonth.month,
      amount: 5100,
    })

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: brian.id, financialYear })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()
    assert.lengthOf(body.months, 12)
    assert.equal(body.months[0].year, firstMonth.year)
    assert.equal(body.months[0].month, firstMonth.month)
    assert.equal(body.months[0].bySource[source.id], 4800)
    assert.equal(body.months[1].bySource[source.id], 5100)
    // Every other month in that past financial year has no entry, so it's
    // backfilled from projected (5000) rather than showing $0.
    assert.equal(body.months[2].total, 5000)
    assert.isTrue(body.months[2].estimated)
    assert.equal(body.ytdTotal, 4800 + 5100 + 5000 * 10)
  })

  test('only includes months up to the current one for the current financial year', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const financialYear = currentFinancialYear()
    const now = DateTime.local()
    const expectedCount =
      financialYearMonths(financialYear).findIndex(
        (m) => m.year === now.year && m.month === now.month
      ) + 1
    await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: brian.id, financialYear })
      .loginAs(brian)

    response.assertStatus(200)
    assert.lengthOf(response.body().months, expectedCount)
  })

  test('returns no months for a future financial year', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const financialYear = currentFinancialYear() + 1

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: brian.id, financialYear })
      .loginAs(brian)

    response.assertStatus(200)
    assert.lengthOf(response.body().months, 0)
    assert.equal(response.body().ytdTotal, 0)
  })

  test('attributes unattributed entries to the right person, not the household', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const ariel = await User.findByOrFail('fullName', 'Ariel')
    const financialYear = currentFinancialYear() - 1
    const firstMonth = financialYearMonths(financialYear)[0]!
    await IncomeEntry.create({
      userId: brian.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 700,
      note: 'Dividend',
      taxWithheld: false,
    })
    await IncomeEntry.create({
      userId: ariel.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 300,
      note: 'Bonus',
      taxWithheld: true,
    })

    const brianResponse = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: brian.id, financialYear })
      .loginAs(brian)
    const arielResponse = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: ariel.id, financialYear })
      .loginAs(brian)

    assert.equal(brianResponse.body().months[0].total, 700)
    assert.equal(arielResponse.body().months[0].total, 300)
  })

  test('does not add an "Other income" line for a zero-amount unattributed entry', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const financialYear = currentFinancialYear() - 1
    const firstMonth = financialYearMonths(financialYear)[0]!
    await IncomeEntry.create({
      userId: brian.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 0,
    })

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: brian.id, financialYear })
      .loginAs(brian)

    assert.equal(response.body().months[0].total, 0)
  })
})
