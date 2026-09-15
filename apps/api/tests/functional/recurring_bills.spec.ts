import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('RecurringBills / index', () => {
  test('lists recurring bills ordered by name', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await RecurringBill.create({
      name: 'VPN',
      amount: 39.99,
      frequency: 'annual',
      dueDay: 15,
      dueMonth: 6,
    })
    await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
    })

    const response = await client.get('/api/recurring-bills').loginAs(adam)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((b: { name: string }) => b.name),
      ['Costco Membership', 'VPN']
    )
  })

  test('excludes paused, archived, and removed bills by default, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const paused = await RecurringBill.create({ name: 'Kayo', amount: 45.99, frequency: 'monthly' })
    paused.isPaused = true
    await paused.save()
    const archived = await RecurringBill.create({
      name: 'Nintendo',
      amount: 29.95,
      frequency: 'annual',
    })
    archived.isArchived = true
    await archived.save()
    const removed = await RecurringBill.create({
      name: 'Cancelled',
      amount: 10,
      frequency: 'annual',
    })
    removed.isActive = false
    await removed.save()

    const defaultResponse = await client.get('/api/recurring-bills').loginAs(adam)
    const defaultNames = defaultResponse.body().data.map((b: { name: string }) => b.name)
    assert.notInclude(defaultNames, 'Kayo')
    assert.notInclude(defaultNames, 'Nintendo')
    assert.notInclude(defaultNames, 'Cancelled')

    const hiddenResponse = await client
      .get('/api/recurring-bills')
      .qs({ includeHidden: true })
      .loginAs(adam)
    const hiddenNames = hiddenResponse.body().data.map((b: { name: string }) => b.name)
    assert.include(hiddenNames, 'Kayo')
    assert.include(hiddenNames, 'Nintendo')
    assert.include(hiddenNames, 'Cancelled')
  })
})

test.group('RecurringBills / store', () => {
  test('derives dueDay/dueMonth from nextDueOn', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.post('/api/recurring-bills').withCsrfToken().loginAs(adam).json({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      nextDueOn: '2026-01-31',
    })

    response.assertStatus(201)
    assert.equal(response.body().data.dueDay, 31)
    assert.equal(response.body().data.dueMonth, 1)
    assert.notProperty(response.body().data, 'nextDueOn')
  })

  test('derives dueYear from nextDueOn for a triennial bill', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.post('/api/recurring-bills').withCsrfToken().loginAs(adam).json({
      name: 'Passport Renewal',
      amount: 388,
      frequency: 'triennial',
      nextDueOn: '2026-05-20',
    })

    response.assertStatus(201)
    assert.equal(response.body().data.dueDay, 20)
    assert.equal(response.body().data.dueMonth, 5)
    assert.equal(response.body().data.dueYear, 2026)
  })

  test('rejects a "custom" frequency - no longer supported', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/recurring-bills')
      .withCsrfToken()
      .loginAs(adam)
      .json({ name: 'Fortnightly thing', amount: 10, frequency: 'custom', nextDueOn: '2026-01-01' })

    response.assertStatus(422)
  })
})

test.group('RecurringBills / update', () => {
  test('re-derives dueDay/dueMonth when nextDueOn changes', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
    })

    const response = await client
      .patch(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ nextDueOn: '2027-02-28' })

    response.assertStatus(200)
    assert.equal(response.body().data.dueDay, 28)
    assert.equal(response.body().data.dueMonth, 2)
  })

  test('leaves dueDay/dueMonth untouched when nextDueOn is not provided', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
    })

    const response = await client
      .patch(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 70 })

    response.assertStatus(200)
    assert.equal(response.body().data.dueDay, 31)
    assert.equal(response.body().data.amount, 70)
  })

  test('archiving a bill clears an existing pause', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({ name: 'Kayo', amount: 45.99, frequency: 'monthly' })
    bill.isPaused = true
    await bill.save()

    const response = await client
      .patch(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ isArchived: true })

    response.assertStatus(200)
    assert.equal(response.body().data.isArchived, true)
    assert.equal(response.body().data.isPaused, false)
  })
})

test.group('RecurringBills / destroy', () => {
  test('rejects removing a bill that is not archived', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
    })

    const response = await client
      .delete(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(409)
    assert.isNotNull(await RecurringBill.find(bill.id))
  })

  test('permanently deletes an archived bill and its payment history', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
    })
    bill.isArchived = true
    await bill.save()
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2026,
      month: 1,
      paid: true,
    })

    const response = await client
      .delete(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    assert.isNull(await RecurringBill.find(bill.id))
    assert.lengthOf(await RecurringBillPayment.query().where('recurringBillId', bill.id), 0)
  })
})

test.group('RecurringBills / upsertPayment', () => {
  test('creates a payment row marking the month paid', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paid)
    assert.isNull(response.body().data.amount)
    assert.equal(response.body().data.recurringBillId, bill.id)
  })

  test('creates a payment row with an explicit amount override, defaulting paid to false', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Council Rates',
      amount: 2689.3,
      frequency: 'annual',
      dueDay: 30,
      dueMonth: 9,
    })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/9`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 2750.15 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 2750.15)
    assert.isFalse(response.body().data.paid)
  })

  test('updates the existing payment row for that month rather than duplicating it', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: false })

    response.assertStatus(200)
    assert.isFalse(response.body().data.paid)
    const payments = await RecurringBillPayment.query().where('recurringBillId', bill.id)
    assert.lengthOf(payments, 1)
  })

  test('updating paid alone does not clear a previously saved amount override', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Council Rates',
      amount: 2689.3,
      frequency: 'annual',
      dueDay: 30,
      dueMonth: 9,
    })
    await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/9`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 2750.15 })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/9`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paid)
    assert.equal(response.body().data.amount, 2750.15)
  })

  test('updating amount alone does not clear a previously saved paid flag', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ amount: 50 })

    response.assertStatus(200)
    // Loose equal, not isTrue: this value came back through a fresh DB
    // re-query inside the controller, and SQLite has no native boolean type
    // - Lucid returns it as 1/0 for a row read this way rather than a
    // genuine JS boolean (see the equivalent utility_bills.spec.ts case).
    assert.equal(response.body().data.paid, true)
    assert.equal(response.body().data.amount, 50)
  })

  test('returns 404 for a non-existent recurring bill', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/recurring-bills/999999/payments/2026/3')
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    response.assertStatus(404)
  })

  test('rejects a non-boolean paid value', async ({ client }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: 'yes' })

    response.assertStatus(422)
  })
})

test.group('RecurringBills / upcoming', () => {
  test('flags bills due within 30 days and sorts soonest-first', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')
    const in60Days = today.plus({ days: 60 })
    const in10Days = today.plus({ days: 10 })
    await RecurringBill.create({
      name: 'Due in 60 days',
      amount: 10,
      frequency: 'annual',
      dueDay: in60Days.day,
      dueMonth: in60Days.month,
    })
    await RecurringBill.create({
      name: 'Due in 10 days',
      amount: 10,
      frequency: 'annual',
      dueDay: in10Days.day,
      dueMonth: in10Days.month,
    })
    await RecurringBill.create({
      name: 'No next due date',
      amount: 10,
      frequency: 'monthly',
      dueDay: null,
    })
    await RecurringBill.create({
      name: 'Also no next due date',
      amount: 10,
      frequency: 'monthly',
      dueDay: null,
    })

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(adam)

    response.assertStatus(200)
    const names = response.body().data.map((b: { name: string }) => b.name)
    assert.deepEqual(names.slice(0, 2), ['Due in 10 days', 'Due in 60 days'])
    assert.sameMembers(names.slice(2), ['No next due date', 'Also no next due date'])
    assert.isTrue(response.body().data[0].dueSoon)
    assert.isFalse(response.body().data[1].dueSoon)
    assert.isNull(response.body().data[2].daysUntilDue)
    assert.isNull(response.body().data[3].daysUntilDue)
  })

  test("an annual bill's due month/day repeats indefinitely, independent of year", async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')
    // A month that has already passed this year rolls to next year, not
    // "overdue forever" - the stored day/month has no year of its own.
    const alreadyPassed = today.minus({ months: 2 })
    await RecurringBill.create({
      name: 'Car Insurance',
      amount: 600,
      frequency: 'annual',
      dueDay: alreadyPassed.day,
      dueMonth: alreadyPassed.month,
    })

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(adam)

    response.assertStatus(200)
    const car = response.body().data[0]
    assert.equal(car.name, 'Car Insurance')
    assert.isAtLeast(car.daysUntilDue, 0)
    assert.isTrue(DateTime.fromISO(car.nextDueOn) >= today)
  })

  test("a triennial bill's due date lands 3 years out, not next year, once its anchor cycle has passed", async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')
    // Anchored 2 years ago, in a month that has already passed this year -
    // the next occurrence is 1 year from now (completing the 3-year cycle),
    // not next month/year the way an annual bill would roll forward.
    const anchor = today.minus({ years: 2, months: 1 })
    await RecurringBill.create({
      name: 'Passport Renewal',
      amount: 388,
      frequency: 'triennial',
      dueDay: anchor.day,
      dueMonth: anchor.month,
      dueYear: anchor.year,
    })

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(adam)

    response.assertStatus(200)
    const passport = response.body().data[0]
    assert.equal(passport.name, 'Passport Renewal')
    const nextDueOn = DateTime.fromISO(passport.nextDueOn)
    assert.equal(nextDueOn.year, anchor.year + 3)
    assert.equal(nextDueOn.month, anchor.month)
  })

  test('marking the current occurrence paid jumps nextDueOn straight to the next cycle, without waiting for the due date to pass', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')
    // Anchored so this cycle's due date is still in the future (today counts
    // as "not yet due") - marking it paid now should still skip ahead
    // immediately, not just once the date itself lapses.
    const dueDate = today.plus({ days: 10 })
    const bill = await RecurringBill.create({
      name: 'VPN',
      amount: 39.99,
      frequency: 'triennial',
      dueDay: dueDate.day,
      dueMonth: dueDate.month,
      dueYear: dueDate.year,
    })

    const beforePaid = await client.get('/api/recurring-bills/upcoming').loginAs(adam)
    const beforeDueOn = DateTime.fromISO(beforePaid.body().data[0].nextDueOn)
    assert.equal(beforeDueOn.toISODate(), dueDate.toISODate())

    await client
      .put(`/api/recurring-bills/${bill.id}/payments/${dueDate.year}/${dueDate.month}`)
      .withCsrfToken()
      .loginAs(adam)
      .json({ paid: true })

    const afterPaid = await client.get('/api/recurring-bills/upcoming').loginAs(adam)
    const afterDueOn = DateTime.fromISO(afterPaid.body().data[0].nextDueOn)
    assert.equal(afterDueOn.year, dueDate.year + 3)
    assert.equal(afterDueOn.month, dueDate.month)
  })

  test('a monthly bill rolls forward to next month once past its due day', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const today = DateTime.utc().startOf('day')
    const yesterday = today.minus({ days: 1 })
    await RecurringBill.create({
      name: 'Streaming',
      amount: 15,
      frequency: 'monthly',
      dueDay: yesterday.day,
    })

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(adam)

    response.assertStatus(200)
    const streaming = response.body().data[0]
    assert.equal(streaming.name, 'Streaming')
    assert.isAtLeast(streaming.daysUntilDue, 0)
    assert.isBelow(streaming.daysUntilDue, 31)
  })

  test('excludes inactive bills', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Cancelled thing',
      amount: 10,
      frequency: 'annual',
      dueDay: 15,
      dueMonth: DateTime.utc().month,
    })
    bill.isActive = false
    await bill.save()

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(adam)

    assert.lengthOf(response.body().data, 0)
  })

  test('excludes paused and archived bills, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const paused = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 15,
    })
    paused.isPaused = true
    await paused.save()
    const archived = await RecurringBill.create({
      name: 'Nintendo',
      amount: 29.95,
      frequency: 'annual',
      dueDay: 15,
      dueMonth: DateTime.utc().month,
    })
    archived.isArchived = true
    await archived.save()

    const defaultResponse = await client.get('/api/recurring-bills/upcoming').loginAs(adam)
    assert.lengthOf(defaultResponse.body().data, 0)

    const hiddenResponse = await client
      .get('/api/recurring-bills/upcoming')
      .qs({ includeHidden: true })
      .loginAs(adam)
    assert.lengthOf(hiddenResponse.body().data, 2)
  })
})

test.group('RecurringBills / show', () => {
  test('returns a single bill with its computed next due date', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })

    const response = await client.get(`/api/recurring-bills/${bill.id}`).loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Kayo')
    assert.equal(response.body().data.amount, 45.99)
    // `show` shares its due-info computation with `upcoming` - assert the
    // actual next date (a monthly bill's day 5, rolled to next month once
    // this month's has passed), not just the shape of the fields.
    const today = DateTime.local().startOf('day')
    const thisMonth = today.set({ day: 5 })
    const expected = thisMonth >= today ? thisMonth : thisMonth.plus({ months: 1 })
    assert.equal(response.body().data.nextDueOn, expected.toISODate())
    assert.equal(response.body().data.daysUntilDue, Math.floor(expected.diff(today, 'days').days))
    assert.isBoolean(response.body().data.dueSoon)
  })

  test('returns 404 for a non-existent bill', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/recurring-bills/999999').loginAs(adam)

    response.assertStatus(404)
  })
})

test.group('RecurringBills / payments', () => {
  test('lists payments newest first', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2026,
      month: 1,
      paid: true,
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2026,
      month: 3,
      paid: true,
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2025,
      month: 12,
      paid: true,
    })

    const response = await client.get(`/api/recurring-bills/${bill.id}/payments`).loginAs(adam)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((p: { year: number; month: number }) => `${p.year}-${p.month}`),
      ['2026-3', '2026-1', '2025-12']
    )
  })

  test('returns 404 for a non-existent bill', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/recurring-bills/999999/payments').loginAs(adam)

    response.assertStatus(404)
  })
})

test.group('RecurringBills / trend', () => {
  test('falls back to the bill amount for a payment with no stored amount', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 50,
      frequency: 'monthly',
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2026,
      month: 1,
      paid: true,
      amount: null,
    })
    await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2026,
      month: 2,
      paid: true,
      amount: 60,
    })

    const response = await client.get(`/api/recurring-bills/${bill.id}/trend`).loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().months.length, 2)
    assert.equal(response.body().months[0].amount, 50)
    assert.equal(response.body().months[1].amount, 60)
    assert.equal(response.body().average, 55)
    assert.equal(response.body().trend, 'up')
  })

  test('returns nulls and an empty window when there are no payments', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({ name: 'Kayo', amount: 50, frequency: 'monthly' })

    const response = await client.get(`/api/recurring-bills/${bill.id}/trend`).loginAs(adam)

    response.assertStatus(200)
    assert.isNull(response.body().average)
    assert.lengthOf(response.body().months, 0)
  })

  test('returns 404 for a non-existent bill', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/recurring-bills/999999/trend').loginAs(adam)

    response.assertStatus(404)
  })
})

test.group('RecurringBills / destroyPayment', () => {
  test('deletes a single payment row without touching the bill', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
    })
    const payment = await RecurringBillPayment.create({
      recurringBillId: bill.id,
      year: 2026,
      month: 3,
      paid: true,
    })

    const response = await client
      .delete(`/api/recurring-bill-payments/${payment.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    assert.isNull(await RecurringBillPayment.find(payment.id))
    assert.isNotNull(await RecurringBill.find(bill.id))
  })

  test('returns 404 for a non-existent payment', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .delete('/api/recurring-bill-payments/999999')
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(404)
  })
})
