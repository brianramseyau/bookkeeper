import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Category from '#models/category'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import UserSubscription from '#models/user_subscription'
import Expense from '#models/expense'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import IncomeTaxSetting from '#models/income_tax_setting'
import { currentFinancialYear } from '#services/financial_year'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('Dashboard / summary', () => {
  test("includes the current month's projected/actual net", async ({ client }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    response.assertStatus(200)
    response.assertBodyContains({
      currentMonth: { year: today.year, month: today.month },
    })
  })

  test('splits a quarterly utility bill into equal monthly shares for monthlyExpenses', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    const utility = await Utility.create({ name: 'Water', frequency: 'quarterly' })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 369.49,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const twoMonthsAgo = today.minus({ months: 2 })
    const shareEntry = response
      .body()
      .monthlyExpenses.find((m: { year: number; month: number }) => {
        return m.year === twoMonthsAgo.year && m.month === twoMonthsAgo.month
      })
    assert.equal(shareEntry.total, 123.16)
  })

  test('lists up to 5 upcoming bills with a nextDueOn, soonest first', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')

    for (let i = 0; i < 6; i++) {
      const dueOn = today.plus({ days: 10 - i })
      await RecurringBill.create({
        name: `Bill ${i}`,
        amount: 10,
        frequency: 'annual',
        dueDay: dueOn.day,
        dueMonth: dueOn.month,
      })
    }
    await RecurringBill.create({
      name: 'No due date',
      amount: 10,
      frequency: 'monthly',
      dueDay: null,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    assert.lengthOf(response.body().upcomingBills, 5)
    assert.equal(response.body().upcomingBills[0].name, 'Bill 5')
  })

  test('rolls a due month/day that already passed this year forward to next year', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')

    // A month that's already passed this year - without rolling forward to
    // next year this would sort as overdue instead of upcoming.
    const alreadyPassed = today.minus({ months: 2 })
    await RecurringBill.create({
      name: 'Car Insurance',
      amount: 600,
      frequency: 'annual',
      dueDay: alreadyPassed.day,
      dueMonth: alreadyPassed.month,
    })
    const in3Days = today.plus({ days: 3 })
    await RecurringBill.create({
      name: 'Rent',
      amount: 2000,
      frequency: 'monthly',
      dueDay: in3Days.day,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const bills = response.body().upcomingBills as { name: string; daysUntilDue: number }[]
    assert.equal(bills[0].name, 'Rent')
    const car = bills.find((b) => b.name === 'Car Insurance')!
    assert.isAtLeast(car.daysUntilDue, 0)
  })

  test("rolls a paid occurrence forward to the bill's next cycle in upcomingBills", async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')

    const bill = await RecurringBill.create({
      name: 'Internet',
      amount: 80,
      frequency: 'monthly',
      dueDay: today.day,
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: today.year,
      month: today.month,
      amount: 80,
      paid: true,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response.body().upcomingBills.find((b: { name: string }) => b.name === 'Internet')
    const nextMonth = today.plus({ months: 1 })
    assert.equal(DateTime.fromISO(entry.nextDueOn).month, nextMonth.month)
  })

  test('sums utility bills and expense actuals into the monthlyExpenses window', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 400,
    })
    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.local(today.year, today.month, 1),
      amount: 300,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const currentMonthEntry = response
      .body()
      .monthlyExpenses.find((m: { year: number; month: number }) => {
        return m.year === today.year && m.month === today.month
      })
    assert.equal(currentMonthEntry.total, 700)
    assert.lengthOf(response.body().monthlyExpenses, 12)
  })

  test('excludes actuals for an expense flagged excludeFromBudget from the monthlyExpenses window', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    const groceries = await Expense.create({ name: 'Groceries' })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.local(today.year, today.month, 1),
      amount: 300,
    })
    const creditCard = await Expense.create({ name: 'Credit Card', excludeFromBudget: true })
    await ExpenseMonthlyActual.create({
      expenseId: creditCard.id,
      occurredOn: DateTime.local(today.year, today.month, 1),
      amount: 900,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const currentMonthEntry = response
      .body()
      .monthlyExpenses.find((m: { year: number; month: number }) => {
        return m.year === today.year && m.month === today.month
      })
    // Only Groceries' 300 counts - Credit Card's 900 is excluded so its
    // already-categorized spend (Groceries, Shopping, etc.) isn't doubled.
    assert.equal(currentMonthEntry.total, 300)
  })

  test('groups current-month expense actuals into categoryBreakdown by category', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    const groceriesCategory = await Category.findByOrFail('name', 'Groceries')
    const groceries = await Expense.create({ name: 'Groceries', categoryId: groceriesCategory.id })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.local(today.year, today.month, 1),
      amount: 300,
    })
    // A month outside the current month must not be counted.
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: today.minus({ months: 1 }),
      amount: 999,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response
      .body()
      .categoryBreakdown.find((c: { name: string }) => c.name === 'Groceries')
    assert.equal(entry.total, 300)
  })

  test('rolls a utility bill into its category in categoryBreakdown', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    const utilitiesCategory = await Category.findByOrFail('name', 'Utilities')
    const utility = await Utility.create({ name: 'Electricity', categoryId: utilitiesCategory.id })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 400,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response
      .body()
      .categoryBreakdown.find((c: { name: string }) => c.name === 'Utilities')
    assert.equal(entry.total, 400)
  })

  test('rolls an active subscription into its category in categoryBreakdown', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const householdCategory = await Category.findByOrFail('name', 'Household')
    await UserSubscription.create({
      userId: adam.id,
      name: 'Streaming',
      categoryId: householdCategory.id,
      amount: 15.99,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response
      .body()
      .categoryBreakdown.find((c: { name: string }) => c.name === 'Household')
    assert.equal(entry.total, 15.99)
  })

  test('excludes a paused or archived subscription from categoryBreakdown', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const householdCategory = await Category.findByOrFail('name', 'Household')
    await UserSubscription.create({
      userId: adam.id,
      name: 'Paused Sub',
      categoryId: householdCategory.id,
      amount: 9.99,
      isPaused: true,
    })
    await UserSubscription.create({
      userId: adam.id,
      name: 'Archived Sub',
      categoryId: householdCategory.id,
      amount: 7.99,
      isArchived: true,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response
      .body()
      .categoryBreakdown.find((c: { name: string }) => c.name === 'Household')
    assert.isUndefined(entry)
  })

  test('rolls a due recurring bill into its category in categoryBreakdown, using a logged payment amount if present', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    const householdCategory = await Category.findByOrFail('name', 'Household')
    const bill = await RecurringBill.create({
      name: 'Car Insurance',
      categoryId: householdCategory.id,
      amount: 600,
      frequency: 'annual',
      dueMonth: today.month,
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: today.year,
      month: today.month,
      amount: 650,
      paid: true,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response
      .body()
      .categoryBreakdown.find((c: { name: string }) => c.name === 'Household')
    assert.equal(entry.total, 650)
  })

  test('excludes a recurring bill from categoryBreakdown outside its due month', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()
    // 6 months offset from the current month, wrapped into 1-12 - always
    // different from today.month regardless of what today.month is.
    const notDueMonth = ((today.month + 5) % 12) + 1
    const householdCategory = await Category.findByOrFail('name', 'Household')
    await RecurringBill.create({
      name: 'Council Rates',
      categoryId: householdCategory.id,
      amount: 300,
      frequency: 'annual',
      dueMonth: notDueMonth,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const entry = response
      .body()
      .categoryBreakdown.find((c: { name: string }) => c.name === 'Household')
    assert.isUndefined(entry)
  })

  test('year/month query params drive currentMonth, monthlyExpenses window, and categoryBreakdown', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const groceriesCategory = await Category.findByOrFail('name', 'Groceries')
    const groceries = await Expense.create({ name: 'Groceries', categoryId: groceriesCategory.id })
    await ExpenseMonthlyActual.create({
      expenseId: groceries.id,
      occurredOn: DateTime.local(2025, 6, 1),
      amount: 250,
    })

    const response = await client.get('/api/dashboard/summary?year=2025&month=6').loginAs(adam)

    response.assertBodyContains({ currentMonth: { year: 2025, month: 6 } })
    const body = response.body()
    // The trailing 12-month window ends at the viewed month, not real today.
    assert.equal(body.monthlyExpenses.at(-1).year, 2025)
    assert.equal(body.monthlyExpenses.at(-1).month, 6)
    const entry = body.categoryBreakdown.find((c: { name: string }) => c.name === 'Groceries')
    assert.equal(entry.total, 250)
  })

  test('upcomingBills stays anchored to real today regardless of the viewed month', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')
    const in3Days = today.plus({ days: 3 })
    await RecurringBill.create({
      name: 'Rent',
      amount: 2000,
      frequency: 'monthly',
      dueDay: in3Days.day,
    })

    const response = await client.get('/api/dashboard/summary?year=2020&month=1').loginAs(adam)

    const bill = response.body().upcomingBills.find((b: { name: string }) => b.name === 'Rent')
    assert.equal(bill.daysUntilDue, 3)
  })

  test('sums net household income across the trailing 12-month window into totalIncome', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const eve = await User.findByOrFail('fullName', 'Eve')
    const today = DateTime.local()
    const financialYear = currentFinancialYear()

    // Salary: source-tied, already net take-home.
    const salarySource = await IncomeSource.create({
      userId: adam.id,
      name: 'Salary',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    await IncomeEntry.create({
      incomeSourceId: salarySource.id,
      year: today.year,
      month: today.month,
      amount: 5000,
    })
    // Other income nets through Adam's marginal rate: 1000 - 370 = 630.
    await IncomeEntry.create({
      userId: adam.id,
      year: today.year,
      month: today.month,
      amount: 1000,
      taxWithheld: false,
    })
    await IncomeTaxSetting.create({ userId: adam.id, financialYear, marginalRate: 0.37 })
    // Eve's income is part of the household-wide window too.
    await IncomeEntry.create({
      userId: eve.id,
      year: today.year,
      month: today.month,
      amount: 300,
      taxWithheld: true,
    })
    // Outside the 12-month window - must not count.
    const outside = today.minus({ months: 13 })
    await IncomeEntry.create({
      userId: adam.id,
      year: outside.year,
      month: outside.month,
      amount: 9999,
      taxWithheld: false,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    assert.equal(response.body().totalIncome, 5000 + 630 + 300)
  })

  test('breaks net household income into a 12-month monthlyIncome window', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.local()

    await IncomeEntry.create({
      userId: adam.id,
      year: today.year,
      month: today.month,
      amount: 1000,
      taxWithheld: true,
    })
    const lastMonth = today.minus({ months: 1 })
    await IncomeEntry.create({
      userId: adam.id,
      year: lastMonth.year,
      month: lastMonth.month,
      amount: 500,
      taxWithheld: true,
    })
    // Outside the 12-month window - must not count.
    const outside = today.minus({ months: 13 })
    await IncomeEntry.create({
      userId: adam.id,
      year: outside.year,
      month: outside.month,
      amount: 9999,
      taxWithheld: true,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(adam)

    const body = response.body()
    assert.lengthOf(body.monthlyIncome, 12)
    const currentEntry = body.monthlyIncome.find(
      (m: { year: number; month: number }) => m.year === today.year && m.month === today.month
    )
    assert.equal(currentEntry.total, 1000)
    const lastMonthEntry = body.monthlyIncome.find(
      (m: { year: number; month: number }) =>
        m.year === lastMonth.year && m.month === lastMonth.month
    )
    assert.equal(lastMonthEntry.total, 500)
    // monthlyIncome is a contiguous, ascending 12-month window ending at the
    // viewed (today's) month - pin the whole shape, not just its length, so
    // a gapped, reordered, or wrongly-bounded window would fail here even
    // though the client now joins on a year/month key rather than trusting
    // bucket order.
    for (let i = 1; i < body.monthlyIncome.length; i++) {
      const previous = body.monthlyIncome[i - 1]
      const current = body.monthlyIncome[i]
      assert.equal(current.year * 12 + current.month, previous.year * 12 + previous.month + 1)
    }
    assert.equal(body.monthlyIncome.at(-1).year, today.year)
    assert.equal(body.monthlyIncome.at(-1).month, today.month)
    // monthlyIncome and monthlyExpenses share the same trailing window.
    assert.equal(body.monthlyIncome[0].year, body.monthlyExpenses[0].year)
    assert.equal(body.monthlyIncome[0].month, body.monthlyExpenses[0].month)
  })
})
