import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Expense from '#models/expense'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import ExpensePayment from '#models/expense_payment'
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

  test('aggregates carryover, income, utilities, recurring bills, subscriptions and expenses', async ({
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

    const electricity = await Utility.create({ name: 'Electricity', dueOffsetDays: 20 })
    await UtilityBill.create({ utilityId: electricity.id, year: 2025, month: 12, amount: 380 })
    await UtilityBill.create({ utilityId: electricity.id, year: 2026, month: 1, amount: 400 })
    await UtilityBill.create({
      utilityId: electricity.id,
      year: 2026,
      month: 2,
      amount: 420,
      receivedOn: DateTime.utc(2026, 1, 31),
    })

    await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 15,
    })
    const costco = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 15,
      dueMonth: 2,
    })

    const netflix = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
      dayOfMonth: 10,
    })

    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
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
    assert.equal(electricityLine.dueDate, '2026-02-20T00:00:00.000Z')
    // A real bill with a received date is on record for this month, so the
    // due date is a confirmed fact, not a guess.
    assert.equal(electricityLine.dueDateEstimated, false)

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

    const costcoLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `recurring-bill-${costco.id}`
    )
    // A non-monthly bill shows up in its due month at its full,
    // non-amortized amount, suffixed "(Bill)" to distinguish it from a
    // monthly recurring bill.
    assert.equal(costcoLine.label, 'Costco Membership (Bill)')
    assert.equal(costcoLine.projected, 65)
    assert.equal(costcoLine.actual, 65)
    // Same past-month default as Kayo above.
    assert.equal(costcoLine.paid, true)

    const subscriptionLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `subscription-${netflix.id}`
    )
    assert.equal(subscriptionLine.projected, 22.99)
    assert.equal(subscriptionLine.label, 'Netflix (Brian)')
    assert.equal(subscriptionLine.dueDay, 10)
    // Same past-month default as Kayo above.
    assert.equal(subscriptionLine.paid, true)

    const groceriesLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `expense-${groceries.id}`
    )
    assert.equal(groceriesLine.projected, 300)
    assert.equal(groceriesLine.actual, 300)
    // Feb 2026 is in the past with no ExpensePayment row - same
    // past-month-defaults-to-paid rule as Kayo and Netflix above.
    assert.equal(groceriesLine.paid, true)

    assert.equal(body.expenses.projectedTotal, 833.98)
    assert.equal(body.expenses.actualTotal, 853.98)

    assert.equal(body.projectedNet, 5166.02)
    assert.equal(body.actualNet, 5346.02)
  })

  test('an expense with no actuals and no budget is omitted entirely', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    await Expense.create({ name: 'Household' })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const labels = response.body().expenses.lines.map((l: { label: string }) => l.label)
    assert.notInclude(labels, 'Household')
  })

  test('a non-recurring expense with an actual logged this month appears with no projected amount', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const flights = await Expense.create({ name: 'Flights', isRecurring: false })
    await ExpenseMonthlyActual.create({
      expenseId: flights.id,
      occurredOn: DateTime.fromISO('2026-02-01'),
      amount: 450,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()
    const flightsLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `expense-${flights.id}`
    )
    assert.isDefined(flightsLine)
    assert.isNull(flightsLine.projected)
    assert.equal(flightsLine.actual, 450)
    assert.equal(body.expenses.actualTotal, 450)
    assert.equal(body.expenses.projectedTotal, 0)
  })

  test('a non-recurring expense with no actual logged in the viewed month is omitted, even with a budget or actuals elsewhere', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const flights = await Expense.create({
      name: 'Flights',
      isRecurring: false,
      budgetAmount: 500,
    })
    await ExpenseMonthlyActual.create({
      expenseId: flights.id,
      occurredOn: DateTime.fromISO('2026-01-01'),
      amount: 450,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const labels = response.body().expenses.lines.map((l: { label: string }) => l.label)
    assert.notInclude(labels, 'Flights')
  })

  test('an expense excluded from budget is omitted entirely, even with actuals this month', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const creditCard = await Expense.create({
      name: 'Credit Card',
      excludeFromBudget: true,
    })
    await ExpenseMonthlyActual.create({
      expenseId: creditCard.id,
      occurredOn: DateTime.fromISO('2026-02-01'),
      amount: 900,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()
    const labels = body.expenses.lines.map((l: { label: string }) => l.label)
    assert.notInclude(labels, 'Credit Card')
    assert.equal(body.expenses.actualTotal, 0)
  })

  test('paused or archived recurring bills, subscriptions, and expenses produce no line', async ({
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

    const bikeInsurance = await Expense.create({ name: 'Bike Insurance', budgetAmount: 40 })
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

  test('a quarterly recurring bill only appears in its actual due month, at its full non-amortized amount', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const cleaner = await RecurringBill.create({
      name: 'Cleaner',
      amount: 180,
      frequency: 'quarterly',
      dueDay: 1,
      dueMonth: 2,
    })

    const dueMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)
    const dueLine = dueMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `recurring-bill-${cleaner.id}`)
    assert.equal(dueLine.label, 'Cleaner (Bill)')
    assert.equal(dueLine.projected, 180)
    assert.equal(dueLine.actual, 180)

    // 2026-03 isn't a multiple of 3 months from the Feb anchor - not a due
    // month, so no line at all rather than a fractional amortized figure.
    const notDueMonth = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)
    const notDueLine = notDueMonth
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `recurring-bill-${cleaner.id}`)
    assert.isUndefined(notDueLine)
  })

  test("a recurring bill's actual mirrors its configured amount unless a RecurringBillPayment overrides it", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const councilRates = await RecurringBill.create({
      name: 'Council Rates',
      amount: 2689.3,
      frequency: 'annual',
      dueDay: 30,
      dueMonth: 9,
    })

    const withoutOverride = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 9 })
      .loginAs(brian)
    const lineWithoutOverride = withoutOverride
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `recurring-bill-${councilRates.id}`)
    assert.equal(lineWithoutOverride.actual, 2689.3)

    await RecurringBillPayment.create({
      recurringBillId: councilRates.id,
      year: 2026,
      month: 9,
      amount: 2750.15,
      paid: false,
    })

    const withOverride = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 9 })
      .loginAs(brian)
    const lineWithOverride = withOverride
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `recurring-bill-${councilRates.id}`)
    assert.equal(lineWithOverride.actual, 2750.15)
  })

  test("a subscription's actual mirrors its configured amount unless a SubscriptionPayment overrides it, leaving projected untouched", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const netflix = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
      dayOfMonth: 10,
    })

    const withoutOverride = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)
    const lineWithoutOverride = withoutOverride
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `subscription-${netflix.id}`)
    assert.equal(lineWithoutOverride.actual, 22.99)
    assert.equal(lineWithoutOverride.projected, 22.99)

    // A price increase, recorded against the month it took effect rather
    // than silently rewriting past months to the new live amount.
    await SubscriptionPayment.create({
      userSubscriptionId: netflix.id,
      year: 2026,
      month: 3,
      amount: 24.99,
      paid: false,
    })

    const withOverride = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)
    const lineWithOverride = withOverride
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `subscription-${netflix.id}`)
    assert.equal(lineWithOverride.actual, 24.99)
    assert.equal(lineWithOverride.projected, 22.99)
  })

  test('an expense with a budget but no actuals this month projects the budget with a null actual', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const household = await Expense.create({ name: 'Household', budgetAmount: 200 })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 2 })
      .loginAs(brian)

    const householdLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `expense-${household.id}`)
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

  test('flags a utility due date as estimated when no bill is on record yet for the viewed month', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const water = await Utility.create({ name: 'Sewage', dueOffsetDays: 14 })
    const today = DateTime.utc()
    const priorMonth = today.minus({ months: 1 })
    // Only a past bill is on record, received on the 18th - no bill yet for
    // the currently viewed (current) month, so its due date can only be a
    // projection from that one data point.
    await UtilityBill.create({
      utilityId: water.id,
      year: priorMonth.year,
      month: priorMonth.month,
      amount: 60,
      receivedOn: DateTime.utc(priorMonth.year, priorMonth.month, 18),
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: today.year, month: today.month })
      .loginAs(brian)

    response.assertStatus(200)
    const body = response.body()

    const waterLine = body.expenses.lines.find(
      (l: { key: string }) => l.key === `utility-${water.id}`
    )
    assert.isNull(waterLine.actual)
    assert.isNotNull(waterLine.dueDate)
    assert.isTrue(waterLine.dueDateEstimated)
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
    // The current month is a live reminder, not missing history - false
    // here isn't a guess, it's the genuine default.
    assert.isFalse(kayoLine.estimated)
    assert.isFalse(netflixLine.estimated)
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
    // Nobody ever recorded these two months, so both `paid` and the
    // configured-amount-fallback `actual` are guesses, not history - flag
    // them as such rather than presenting them as confirmed facts.
    assert.isTrue(kayoLine.estimated)
    assert.isTrue(netflixLine.estimated)
  })

  test('a recurring bill and a subscription are not flagged estimated once a payment row exists for that past month, even without an amount override', async ({
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
    await RecurringBillPayment.create({
      recurringBillId: kayo.id,
      year: lastMonth.year,
      month: lastMonth.month,
      paid: true,
    })
    await SubscriptionPayment.create({
      userSubscriptionId: netflix.id,
      year: lastMonth.year,
      month: lastMonth.month,
      paid: true,
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
    // A row exists for that month - someone already confirmed it, even
    // though the actual amount charged still isn't on record.
    assert.isFalse(kayoLine.estimated)
    assert.isFalse(netflixLine.estimated)
  })

  test('an expense is flagged estimated for a past month with no ExpensePayment row, without mislabeling its real logged actual', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const lastMonth = DateTime.utc().minus({ months: 1 })
    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.utc(lastMonth.year, lastMonth.month, 1),
      amount: 300,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: lastMonth.year, month: lastMonth.month })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `expense-${groceries.id}`)
    assert.equal(groceriesLine.paid, true)
    assert.isTrue(groceriesLine.estimated)
    // The 300 is real logged spending, not a fabricated stand-in - only
    // `paid` was assumed here.
    assert.equal(groceriesLine.actual, 300)
  })

  test("an expense's line reflects an ExpensePayment row for the viewed month", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.fromISO('2026-03-01'),
      amount: 300,
    })
    await ExpensePayment.create({ expenseId: groceries.id, year: 2026, month: 3, paid: true })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `expense-${groceries.id}`)
    assert.equal(groceriesLine.paid, true)
  })

  test("an ExpensePayment row for a different month doesn't leak into this month's line", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.fromISO('2026-03-01'),
      amount: 300,
    })
    // Explicitly false, so a leak is distinguishable from March's own
    // past-month default (both 2026-02 and 2026-03 are in the past relative
    // to "today" - if March's line leaked Feb's row it would read false;
    // isolated correctly, it falls back to true instead).
    await ExpensePayment.create({ expenseId: groceries.id, year: 2026, month: 2, paid: false })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `expense-${groceries.id}`)
    assert.equal(groceriesLine.paid, true)
  })

  test('defaults an expense to unpaid for the current month with no payment row', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const today = DateTime.utc()
    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: today,
      amount: 300,
    })

    const response = await client
      .get('/api/standard-month')
      .qs({ year: today.year, month: today.month })
      .loginAs(brian)

    const groceriesLine = response
      .body()
      .expenses.lines.find((l: { key: string }) => l.key === `expense-${groceries.id}`)
    assert.equal(groceriesLine.paid, false)
  })

  test('skips the ExpensePayment lookup entirely when there are no expenses', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    await Expense.query().delete()

    const response = await client
      .get('/api/standard-month')
      .qs({ year: 2026, month: 3 })
      .loginAs(brian)

    response.assertStatus(200)
    assert.isEmpty(
      response.body().expenses.lines.filter((l: { key: string }) => l.key.startsWith('expense-'))
    )
  })
})
