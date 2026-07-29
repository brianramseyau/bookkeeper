import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Category from '#models/category'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryPayment from '#models/category_payment'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import MonthCarryover from '#models/month_carryover'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'

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
      frequency: 'monthly',
      payDayOfMonth: 15,
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

    const netflix = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
      dayOfMonth: 10,
    })

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
    assert.equal(electricityLine.paid, false)

    const kayoLine = body.expenses.lines.find((l: { label: string }) => l.label === 'Kayo')
    assert.equal(kayoLine.projected, 45.99)
    assert.equal(kayoLine.actual, 45.99)
    // Feb 2026 is in the past with no RecurringBillPayment row - defaults
    // to paid rather than nagging about a bill from months ago.
    assert.equal(kayoLine.paid, true)

    assert.notInclude(
      body.expenses.lines.map((l: { key: string }) => l.key),
      'recurring-bills-avg'
    )
    assert.equal(body.expenses.amortizedBills.total, 5.42)
    const costcoAmortized = body.expenses.amortizedBills.items.find(
      (i: { label: string }) => i.label === 'Costco Membership'
    )
    assert.equal(costcoAmortized.amount, 65)
    assert.equal(costcoAmortized.frequency, 'annual')
    assert.equal(costcoAmortized.monthlyShare, 5.42)

    const subscriptionLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscription-${netflix.id}`
    )
    assert.equal(subscriptionLine.projected, 22.99)
    assert.equal(subscriptionLine.label, 'Netflix (Brian)')
    assert.equal(subscriptionLine.dueDay, 10)
    // Same past-month default as Kayo above.
    assert.equal(subscriptionLine.paid, true)

    const groceriesLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `category-${groceries.id}`
    )
    assert.equal(groceriesLine.projected, 300)
    assert.equal(groceriesLine.actual, 300)
    // Feb 2026 is in the past with no CategoryPayment row - same
    // past-month-defaults-to-paid rule as Kayo and Netflix above.
    assert.equal(groceriesLine.paid, true)

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

  test('paused or archived recurring bills, subscriptions, and categories produce no line', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const pausedBill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
    })
    pausedBill.isPaused = true
    await pausedBill.save()
    const archivedBill = await RecurringBill.create({
      name: 'Nintendo',
      amount: 29.95,
      frequency: 'annual',
    })
    archivedBill.isArchived = true
    await archivedBill.save()

    const pausedSub = await UserSubscription.create({
      userId: brian.id,
      name: 'Paused Sub',
      amount: 9.99,
    })
    pausedSub.isPaused = true
    await pausedSub.save()

    const bikeInsurance = await Category.create({ name: 'Bike Insurance', budgetAmount: 40 })
    bikeInsurance.isArchived = true
    await bikeInsurance.save()

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const labels = response.body().expenses.lines.map((l: { label: string }) => l.label)
    assert.notInclude(labels, 'Kayo')
    assert.notInclude(labels, 'Nintendo')
    assert.notInclude(labels, 'Paused Sub (Brian)')
    assert.notInclude(labels, 'Bike Insurance')
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

    // 60 * (52/2) periods/year / 12 months = 130/mo, rounded to 2dp.
    assert.equal(body.expenses.amortizedBills.total, 130)
    const cleanerAmortized = body.expenses.amortizedBills.items.find(
      (i: { label: string }) => i.label === 'Cleaner'
    )
    assert.equal(cleanerAmortized.monthlyShare, 130)

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
      frequency: 'monthly',
      payDayOfMonth: 15,
    })

    // A utility with no bills at all yet. Named distinctly from the
    // "Internet" utility the dev-data seeder creates, to avoid colliding
    // with it under the unique name constraint.
    const broadband = await Utility.create({ name: 'Broadband' })
    // A utility with bills, but none for the viewed month.
    const gas = await Utility.create({ name: 'Gas' })
    await UtilityBill.create({ utilityId: gas.id, year: 2026, month: 1, amount: 90 })

    // A user with no fullName, whose subscription label falls back to email.
    const noName = await User.create({
      email: 'noname@example.com',
      password: 'password123',
    })
    const spotify = await UserSubscription.create({
      userId: noName.id,
      name: 'Spotify',
      amount: 11.99,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()

    const salaryLine = body.income.lines.find(
      (l: { key: string }) => l.key === `income-source-${salary.id}`
    )
    // Feb 2026 is in the past with nothing logged, so actual is backfilled
    // from projected rather than showing a misleading $0.
    assert.equal(salaryLine.actual, 5000)
    assert.isTrue(salaryLine.estimated)

    // A utility with no recorded amount for the viewed month is only shown
    // as a placeholder for the current/future month (a live reminder) - Feb
    // 2026 is in the past, so both utilities are hidden entirely here. See
    // the current-month request below for the placeholder-fallback case.
    assert.isUndefined(
      body.expenses.lines.find((l: { key: string }) => l.key === `utility-${broadband.id}`)
    )
    assert.isUndefined(
      body.expenses.lines.find((l: { key: string }) => l.key === `utility-${gas.id}`)
    )

    const today = DateTime.utc()
    const currentMonthResponse = await client
      .get('/api/standard-month')
      .qs({ year: today.year, month: today.month })
      .loginAs(brian)
    const currentMonthBody = currentMonthResponse.body()

    const broadbandLine = currentMonthBody.expenses.lines.find(
      (l: { key: string }) => l.key === `utility-${broadband.id}`
    )
    assert.equal(broadbandLine.projected, 0)
    assert.isNull(broadbandLine.actual)

    const gasLine = currentMonthBody.expenses.lines.find(
      (l: { key: string }) => l.key === `utility-${gas.id}`
    )
    assert.isNull(gasLine.actual)
    assert.equal(gasLine.paid, false)

    const noNameSubsLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscription-${spotify.id}`
    )
    assert.equal(noNameSubsLine.label, 'Spotify (noname@example.com)')
  })

  test('shows a quarterly utility bill only in its billing month, hiding the covered non-billing months', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const water = await Utility.create({ name: 'Water', frequency: 'quarterly' })
    // Covers Feb-Apr 2026, billed in April.
    await UtilityBill.create({
      utilityId: water.id,
      year: 2026,
      month: 4,
      amount: 369.49,
      paid: true,
    })

    const billingMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 4 })
      .loginAs(brian)
    const billingLine = billingMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `utility-${water.id}`)
    // The billing month shows the real full bill amount for both actual
    // and projected - with only one bill on record, the "average" of the
    // full bill amounts is just that one bill's total.
    assert.equal(billingLine.actual, 369.49)
    assert.equal(billingLine.projected, 369.49)
    assert.isTrue(billingLine.editable)
    assert.equal(billingLine.paid, true)

    const coveredMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)
    const coveredLine = coveredMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `utility-${water.id}`)
    // Not the billing month - nothing actually left the account this
    // month, so the utility gets no line here at all rather than a
    // fractional "amortized" figure standing in for a real payment.
    assert.isUndefined(coveredLine)

    const uncoveredMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 12 })
      .loginAs(brian)
    const uncoveredLine = uncoveredMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `utility-${water.id}`)
    // 2026-12 is 8 months after the Apr anchor - not aligned to the 3-month
    // cadence (diff 8 % 3 = 2), so it isn't a predicted billing month either
    // - with no recorded amount and no live billing obligation, the line is
    // dropped entirely rather than shown as an empty placeholder.
    assert.isUndefined(uncoveredLine)
  })

  test('projects 3 pay periods in a month a fortnightly income source lands on 3 times', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const wages = await IncomeSource.create({
      userId: brian.id,
      name: 'Wages',
      expectedAmount: 1300,
      frequency: 'fortnightly',
      anchorDate: DateTime.fromISO('2026-07-22'),
    })

    const twoPeriodMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)
    const twoPeriodLine = twoPeriodMonth
      .body()
      .income.lines.find((l: { key: string }) => l.key === `income-source-${wages.id}`)
    assert.equal(twoPeriodLine.projected, 2600)
    assert.lengthOf(twoPeriodLine.payDates, 2)

    const threePeriodMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 4 })
      .loginAs(brian)
    const threePeriodLine = threePeriodMonth
      .body()
      .income.lines.find((l: { key: string }) => l.key === `income-source-${wages.id}`)
    assert.equal(threePeriodLine.projected, 3900)
    assert.lengthOf(threePeriodLine.payDates, 3)
  })

  test('does not backfill an estimated actual for the current or a future month', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const today = DateTime.local()

    const salary = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 15,
    })

    const currentMonthResponse = await client
      .get('/api/standard-month')
      .qs({ year: today.year, month: today.month })
      .loginAs(brian)
    const currentLine = currentMonthResponse
      .body()
      .income.lines.find((l: { key: string }) => l.key === `income-source-${salary.id}`)
    assert.equal(currentLine.actual, 0)
    assert.isFalse(currentLine.estimated)

    const future = today.plus({ years: 1 })
    const futureResponse = await client
      .get('/api/standard-month')
      .qs({ year: future.year, month: future.month })
      .loginAs(brian)
    const futureLine = futureResponse
      .body()
      .income.lines.find((l: { key: string }) => l.key === `income-source-${salary.id}`)
    assert.equal(futureLine.actual, 0)
    assert.isFalse(futureLine.estimated)
  })

  test('rolls a monthly pay day back to the preceding Friday when it lands on a weekend', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    // 2026-08-14 is a Friday, so pick a month where the 14th falls on a
    // Saturday/Sunday - 2026-11-14 is a Saturday.
    const salary = await IncomeSource.create({
      userId: brian.id,
      name: 'Salary',
      expectedAmount: 3885.72,
      frequency: 'monthly',
      payDayOfMonth: 14,
      weekendRollback: true,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 11 })
      .loginAs(brian)
    const line = response
      .body()
      .income.lines.find((l: { key: string }) => l.key === `income-source-${salary.id}`)

    assert.lengthOf(line.payDates, 1)
    assert.equal(line.payDates[0].slice(0, 10), '2026-11-13')
  })
})

test.group('StandardMonths / paid tracking', () => {
  test("a recurring bill's line reflects a RecurringBillPayment row for the viewed month", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const kayo = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    await RecurringBillPayment.create({
      recurringBillId: kayo.id,
      year: 2026,
      month: 3,
      paid: true,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const kayoLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `recurring-bill-${kayo.id}`)
    assert.equal(kayoLine.paid, true)
  })

  test("a RecurringBillPayment row for a different month doesn't leak into this month's line", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const kayo = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    // Explicitly false, so a leak is distinguishable from March's own
    // past-month default (both 2026-02 and 2026-03 are in the past relative
    // to "today" - if March's line leaked Feb's row it would read false;
    // isolated correctly, it falls back to true instead).
    await RecurringBillPayment.create({
      recurringBillId: kayo.id,
      year: 2026,
      month: 2,
      paid: false,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const kayoLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `recurring-bill-${kayo.id}`)
    assert.equal(kayoLine.paid, true)
  })

  test("a subscription's line reflects a SubscriptionPayment row for the viewed month", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const netflix = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })
    await SubscriptionPayment.create({
      userSubscriptionId: netflix.id,
      year: 2026,
      month: 3,
      paid: true,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const netflixLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `subscription-${netflix.id}`)
    assert.equal(netflixLine.paid, true)
  })

  test('defaults a recurring bill and a subscription to unpaid for the current month with no payment row', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const today = DateTime.utc()
    const kayo = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    const netflix = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: today.year, month: today.month })
      .loginAs(brian)

    const body = response.body()
    const kayoLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `recurring-bill-${kayo.id}`
    )
    const netflixLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscription-${netflix.id}`
    )
    assert.equal(kayoLine.paid, false)
    assert.equal(netflixLine.paid, false)
  })

  test('defaults a recurring bill and a subscription to paid for a past month with no payment row', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const lastMonth = DateTime.utc().minus({ months: 1 })
    const kayo = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    const netflix = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: lastMonth.year, month: lastMonth.month })
      .loginAs(brian)

    const body = response.body()
    const kayoLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `recurring-bill-${kayo.id}`
    )
    const netflixLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscription-${netflix.id}`
    )
    assert.equal(kayoLine.paid, true)
    assert.equal(netflixLine.paid, true)
  })

  test("a category's line reflects a CategoryPayment row for the viewed month", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const groceries = await Category.findByOrFail('name', 'Groceries')
    await CategoryMonthlyActual.create({
      categoryId: groceries.id,
      occurredOn: DateTime.fromISO('2026-03-01'),
      amount: 300,
    })
    await CategoryPayment.create({ categoryId: groceries.id, year: 2026, month: 3, paid: true })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `category-${groceries.id}`)
    assert.equal(groceriesLine.paid, true)
  })

  test("a CategoryPayment row for a different month doesn't leak into this month's line", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const groceries = await Category.findByOrFail('name', 'Groceries')
    await CategoryMonthlyActual.create({
      categoryId: groceries.id,
      occurredOn: DateTime.fromISO('2026-03-01'),
      amount: 300,
    })
    // Explicitly false, so a leak is distinguishable from March's own
    // past-month default (both 2026-02 and 2026-03 are in the past relative
    // to "today" - if March's line leaked Feb's row it would read false;
    // isolated correctly, it falls back to true instead).
    await CategoryPayment.create({ categoryId: groceries.id, year: 2026, month: 2, paid: false })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `category-${groceries.id}`)
    assert.equal(groceriesLine.paid, true)
  })

  test('defaults a category to unpaid for the current month with no payment row', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const today = DateTime.utc()
    const groceries = await Category.findByOrFail('name', 'Groceries')
    await CategoryMonthlyActual.create({
      categoryId: groceries.id,
      occurredOn: today,
      amount: 300,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: today.year, month: today.month })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `category-${groceries.id}`)
    assert.equal(groceriesLine.paid, false)
  })

  test('skips the CategoryPayment lookup entirely when there are no categories', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    await Category.query().delete()

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    response.assertStatus(200)
    assert.isEmpty(
      response.body().expenses.lines.filter((l: { key: string }) => l.key.startsWith('category-'))
    )
  })
})
