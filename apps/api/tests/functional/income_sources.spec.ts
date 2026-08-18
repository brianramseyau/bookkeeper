import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import { currentFinancialYear, financialYearMonths } from '#services/financial_year'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('IncomeSources / index', () => {
  test('lists income sources ordered by name', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeSource.create({
      userId: adam.id,
      name: 'Freelance',
      expectedAmount: 500,
      frequency: 'monthly',
      payDayOfMonth: 1,
    })

    const response = await client.get('/api/income-sources').loginAs(adam)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((s: { name: string }) => s.name),
      ['Freelance', 'Salary']
    )
  })

  test('filters by userId when given', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const eve = await User.findByOrFail('fullName', 'Eve')
    await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeSource.create({
      userId: eve.id,
      name: 'Salary (Eve)',
      expectedAmount: 4000,
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })

    const response = await client.get('/api/income-sources').qs({ userId: eve.id }).loginAs(adam)

    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].name, 'Salary (Eve)')
  })
})

test.group('IncomeSources / store', () => {
  test('creates a monthly income source with a pay day and weekend rollback', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()

    const response = await client.post('/api/income-sources').withCsrfToken().loginAs(adam).json({
      userId: adam.id,
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
    const adam = await loginAsAdam()

    const response = await client.post('/api/income-sources').withCsrfToken().loginAs(adam).json({
      userId: adam.id,
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
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/income-sources')
      .withCsrfToken()
      .loginAs(adam)
      .json({ userId: adam.id, name: 'Salary', expectedAmount: 5000, frequency: 'monthly' })

    response.assertStatus(422)
  })
})

test.group('IncomeSources / update', () => {
  test('updates an income source', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const source = await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .patch(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ expectedAmount: 5500 })

    response.assertStatus(200)
    assert.equal(response.body().data.expectedAmount, 5500)
  })

  test('switches a source from monthly to fortnightly', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const source = await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .patch(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ frequency: 'fortnightly', anchorDate: '2026-07-22', payDayOfMonth: null })

    response.assertStatus(200)
    assert.equal(response.body().data.frequency, 'fortnightly')
    assert.isNull(response.body().data.payDayOfMonth)
  })
})

test.group('IncomeSources / destroy', () => {
  test('soft-deletes an income source', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const source = await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .delete(`/api/income-sources/${source.id}`)
      .withCsrfToken()
      .loginAs(adam)

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
    const adam = await loginAsAdam()
    const eve = await User.findByOrFail('fullName', 'Eve')
    await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeSource.create({
      userId: eve.id,
      name: 'Wages',
      expectedAmount: 2000,
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-01-07'),
    })

    const response = await client.get('/api/income-sources/summary').loginAs(adam)

    response.assertStatus(200)
    const adamSummary = response.body().data.find((s: { userId: number }) => s.userId === adam.id)
    const eveSummary = response.body().data.find((s: { userId: number }) => s.userId === eve.id)
    assert.equal(adamSummary.total, 5000)
    assert.equal(adamSummary.count, 1)
    assert.equal(eveSummary.total, Math.round(((2000 * 26) / 12) * 100) / 100)
    assert.equal(eveSummary.count, 1)
  })

  test('excludes inactive sources from the total and count', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await IncomeSource.create({
      userId: adam.id,
      name: 'Old Job',
      expectedAmount: 1000,
      frequency: 'monthly',
      payDayOfMonth: 1,
      isActive: false,
    })

    const response = await client.get('/api/income-sources/summary').loginAs(adam)

    const adamSummary = response.body().data.find((s: { userId: number }) => s.userId === adam.id)
    assert.equal(adamSummary.total, 0)
    assert.equal(adamSummary.count, 0)
  })
})

test.group('IncomeSources / ytd', () => {
  test('sums actual income per month for a full past financial year, per source', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const financialYear = currentFinancialYear() - 1
    const months = financialYearMonths(financialYear)
    const [firstMonth, secondMonth] = months as [
      { year: number; month: number },
      { year: number; month: number },
    ]
    const source = await IncomeSource.create({
      userId: adam.id,
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
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)

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

  test('reports per-month actual vs projected for the ytd chart', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const financialYear = currentFinancialYear() - 1
    const firstMonth = financialYearMonths(financialYear)[0]!
    const source = await IncomeSource.create({
      userId: adam.id,
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
      note: 'Payslip',
      taxWithheld: true,
    })

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)

    response.assertStatus(200)
    // Month with a real entry: actual is what was logged, projected the cadence figure.
    assert.equal(response.body().months[0].actual, 4800)
    assert.equal(response.body().months[0].projected, 5000)
    // Backfilled month: nothing real was logged, so actual stays 0 while
    // projected carries the expectation.
    assert.equal(response.body().months[1].actual, 0)
    assert.equal(response.body().months[1].projected, 5000)
    assert.isTrue(response.body().months[1].estimated)
    assert.equal(response.body().months[1].total, 5000)
  })

  test('only includes months up to the current one for the current financial year', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const financialYear = currentFinancialYear()
    const now = DateTime.local()
    const expectedCount =
      financialYearMonths(financialYear).findIndex(
        (m) => m.year === now.year && m.month === now.month
      ) + 1
    await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)

    response.assertStatus(200)
    assert.lengthOf(response.body().months, expectedCount)
  })

  test('returns no months for a future financial year', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const financialYear = currentFinancialYear() + 1

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)

    response.assertStatus(200)
    assert.lengthOf(response.body().months, 0)
    assert.equal(response.body().ytdTotal, 0)
  })

  test('attributes unattributed entries to the right person, not the household', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const eve = await User.findByOrFail('fullName', 'Eve')
    const financialYear = currentFinancialYear() - 1
    const firstMonth = financialYearMonths(financialYear)[0]!
    await IncomeEntry.create({
      userId: adam.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 700,
      note: 'Dividend',
      taxWithheld: false,
    })
    await IncomeEntry.create({
      userId: eve.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 300,
      note: 'Bonus',
      taxWithheld: true,
    })

    const adamResponse = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)
    const eveResponse = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: eve.id, financialYear })
      .loginAs(adam)

    assert.equal(adamResponse.body().months[0].total, 700)
    assert.equal(eveResponse.body().months[0].total, 300)
  })

  test('does not add an "Other income" line for a zero-amount unattributed entry', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const financialYear = currentFinancialYear() - 1
    const firstMonth = financialYearMonths(financialYear)[0]!
    await IncomeEntry.create({
      userId: adam.id,
      year: firstMonth.year,
      month: firstMonth.month,
      amount: 0,
    })

    const response = await client
      .get('/api/income-sources/ytd')
      .qs({ userId: adam.id, financialYear })
      .loginAs(adam)

    assert.equal(response.body().months[0].total, 0)
  })
})
