import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import Category from '#models/category'
import CategoryMonthlyActual from '#models/category_monthly_actual'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('Dashboard / summary', () => {
  test("includes the current month's projected/actual net", async ({ client }) => {
    const brian = await loginAsBrian()
    const today = DateTime.local()

    const response = await client.get('/api/dashboard/summary').loginAs(brian)

    response.assertStatus(200)
    response.assertBodyContains({
      currentMonth: { year: today.year, month: today.month },
    })
  })

  test('reports utility trends with a sparkline of recent amounts', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const today = DateTime.local()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 400,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(brian)

    const entry = response.body().utilities.find((u: { name: string }) => u.name === 'Electricity')
    assert.equal(entry.latestAmount, 400)
    assert.deepEqual(entry.sparkline, [400])
  })

  test('splits a quarterly utility bill into equal monthly shares for the sparkline and monthlyExpenses', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const today = DateTime.local()
    const utility = await Utility.create({ name: 'Water', frequency: 'quarterly' })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 369.49,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(brian)

    const entry = response.body().utilities.find((u: { name: string }) => u.name === 'Water')
    assert.equal(entry.latestAmount, 123.16)
    assert.deepEqual(entry.sparkline, [123.16, 123.16, 123.16])

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
    const brian = await loginAsBrian()
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

    const response = await client.get('/api/dashboard/summary').loginAs(brian)

    assert.lengthOf(response.body().upcomingBills, 5)
    assert.equal(response.body().upcomingBills[0].name, 'Bill 5')
  })

  test('rolls a due month/day that already passed this year forward to next year', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
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

    const response = await client.get('/api/dashboard/summary').loginAs(brian)

    const bills = response.body().upcomingBills as { name: string; daysUntilDue: number }[]
    assert.equal(bills[0].name, 'Rent')
    const car = bills.find((b) => b.name === 'Car Insurance')!
    assert.isAtLeast(car.daysUntilDue, 0)
  })

  test('sums utility bills and category actuals into the monthlyExpenses window', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const today = DateTime.local()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 400,
    })
    const groceries = await Category.findByOrFail('name', 'Groceries')
    await CategoryMonthlyActual.create({
      categoryId: groceries.id,
      occurredOn: DateTime.local(today.year, today.month, 1),
      amount: 300,
    })

    const response = await client.get('/api/dashboard/summary').loginAs(brian)

    const currentMonthEntry = response
      .body()
      .monthlyExpenses.find((m: { year: number; month: number }) => {
        return m.year === today.year && m.month === today.month
      })
    assert.equal(currentMonthEntry.total, 700)
    assert.lengthOf(response.body().monthlyExpenses, 12)
  })
})
