import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Category from '#models/category'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import MonthCarryover from '#models/month_carryover'
import RecurringBill from '#models/recurring_bill'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UserSubscription from '#models/user_subscription'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('StandardMonths / show', () => {
  test('defaults to the current calendar month when no year/month is given', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/standard-month').loginAs(brian)

    response.assertStatus(200)
    const today = DateTime.local()
    response.assertBodyContains({ year: today.year, month: today.month })
  })

  test('aggregates carryover, income, utilities, recurring bills, subscriptions and categories', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    await MonthCarryover.create({ year: 2026, month: 2, amount: 1000 })

    const salary = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
    })
    await IncomeEntry.create({
      incomeSourceId: salary.id,
      year: 2026,
      month: 2,
      amount: 5000,
    })
    await IncomeEntry.create({ year: 2026, month: 2, amount: 200 })

    const electricity = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({ utilityId: electricity.id, year: 2025, month: 12, amount: 380 })
    await UtilityBill.create({ utilityId: electricity.id, year: 2026, month: 1, amount: 400 })
    await UtilityBill.create({ utilityId: electricity.id, year: 2026, month: 2, amount: 420 })

    await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 15,
      nextDueOn: DateTime.fromISO('2026-02-15'),
    })
    await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      nextDueOn: DateTime.fromISO('2026-01-31'),
    })

    await UserSubscription.create({ userId: brian.id, name: 'Netflix', amount: 22.99 })

    const groceries = await Category.findByOrFail('name', 'Groceries')
    await CategoryMonthlyActual.create({
      categoryId: groceries.id,
      occurredOn: DateTime.fromISO('2026-02-01'),
      amount: 300,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()

    assert.equal(body.carryover, 1000)

    assert.equal(body.income.projectedTotal, 5000)
    assert.equal(body.income.actualTotal, 5200)

    const electricityLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `utility-${electricity.id}`
    )
    assert.equal(electricityLine.projected, 400)
    assert.equal(electricityLine.actual, 420)

    const kayoLine = body.expenses.lines.find((l: { label: string }) => l.label === 'Kayo')
    assert.equal(kayoLine.projected, 45.99)
    assert.equal(kayoLine.actual, 45.99)

    const recurringAvgLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === 'recurring-bills-avg'
    )
    assert.equal(recurringAvgLine.projected, 5.42)
    assert.isNull(recurringAvgLine.actual)

    const subscriptionsLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscriptions-${brian.id}`
    )
    assert.equal(subscriptionsLine.projected, 22.99)

    const groceriesLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `category-${groceries.id}`
    )
    assert.equal(groceriesLine.projected, 300)
    assert.equal(groceriesLine.actual, 300)

    assert.equal(body.expenses.projectedTotal, 774.4)
    assert.equal(body.expenses.actualTotal, 788.98)

    assert.equal(body.projectedNet, 5225.6)
    assert.equal(body.actualNet, 5411.02)
  })

  test('a category with no actuals and no budget is omitted entirely', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const labels = response.body().expenses.lines.map((l: { label: string }) => l.label)
    assert.notInclude(labels, 'Household')
  })

  test('amortizes a custom-frequency recurring bill and shows a null actual for a budgeted category with no actuals this month', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    // Fortnightly (every 2 weeks): 26 periods/year, amortized to a monthly figure.
    await RecurringBill.create({
      name: 'Cleaner',
      amount: 60,
      frequency: 'custom',
      customIntervalValue: 2,
      customIntervalUnit: 'weeks',
      nextDueOn: DateTime.fromISO('2026-02-01'),
    })

    const household = await Category.findByOrFail('name', 'Household')
    household.budgetAmount = 200
    await household.save()

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()

    const recurringAvgLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === 'recurring-bills-avg'
    )
    // 60 * (52/2) periods/year / 12 months = 130/mo, rounded to 2dp.
    assert.equal(recurringAvgLine.projected, 130)

    const householdLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `category-${household.id}`
    )
    assert.equal(householdLine.projected, 200)
    assert.isNull(householdLine.actual)
  })

  test('falls back sensibly when an income source, utility or user has no data for the viewed month', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    // Income source defined, but no entry was ever logged for it this month.
    const salary = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
    })

    // A utility with no bills at all yet.
    const internet = await Utility.create({ name: 'Internet' })
    // A utility with bills, but none for the viewed month.
    const gas = await Utility.create({ name: 'Gas' })
    await UtilityBill.create({ utilityId: gas.id, year: 2026, month: 1, amount: 90 })

    // A user with no fullName, whose subscriptions label falls back to email.
    const noName = await User.create({
      email: 'noname@example.com',
      password: 'password123',
    })
    await UserSubscription.create({ userId: noName.id, name: 'Spotify', amount: 11.99 })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()

    const salaryLine = body.income.lines.find(
      (l: { key: string }) => l.key === `income-source-${salary.id}`
    )
    assert.equal(salaryLine.actual, 0)

    const internetLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `utility-${internet.id}`
    )
    assert.equal(internetLine.projected, 0)
    assert.isNull(internetLine.actual)

    const gasLine = body.expenses.lines.find((l: { key: string }) => l.key === `utility-${gas.id}`)
    assert.isNull(gasLine.actual)

    const noNameSubsLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscriptions-${noName.id}`
    )
    assert.equal(noNameSubsLine.label, "noname@example.com's Subscriptions")
  })

  test('splits a quarterly utility bill evenly across its covered months, and only lets the billing month be edited', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const water = await Utility.create({ name: 'Water', frequency: 'quarterly' })
    // Covers Feb-Apr 2026, billed in April.
    await UtilityBill.create({ utilityId: water.id, year: 2026, month: 4, amount: 369.49 })

    const billingMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 4 })
      .loginAs(brian)
    const billingLine = billingMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `utility-${water.id}`)
    assert.equal(billingLine.actual, 123.16)
    assert.equal(billingLine.projected, 123.16)
    assert.isTrue(billingLine.editable)

    const coveredMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)
    const coveredLine = coveredMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `utility-${water.id}`)
    assert.equal(coveredLine.actual, 123.16)
    assert.isFalse(coveredLine.editable)

    const uncoveredMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 12 })
      .loginAs(brian)
    const uncoveredLine = uncoveredMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `utility-${water.id}`)
    assert.isNull(uncoveredLine.actual)
    // 2026-12 is 8 months after the Apr anchor - not aligned to the 3-month
    // cadence (diff 8 % 3 = 2), so it isn't a predicted billing month either.
    assert.isFalse(uncoveredLine.editable)
  })
})
