import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('RecurringBills / index', () => {
  test('lists recurring bills ordered by name', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await RecurringBill.create({
      name: 'VPN',
      amount: 39.99,
      frequency: 'annual',
      dueDay: 15,
      dueMonth: 6,
      nextDueOn: DateTime.fromISO('2026-06-15'),
    })
    await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
      nextDueOn: DateTime.fromISO('2026-01-31'),
    })

    const response = await client.get('/api/recurring-bills').loginAs(brian)

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
    const brian = await loginAsBrian()
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

    const defaultResponse = await client.get('/api/recurring-bills').loginAs(brian)
    const defaultNames = defaultResponse.body().data.map((b: { name: string }) => b.name)
    assert.notInclude(defaultNames, 'Kayo')
    assert.notInclude(defaultNames, 'Nintendo')
    assert.notInclude(defaultNames, 'Cancelled')

    const hiddenResponse = await client
      .get('/api/recurring-bills')
      .qs({ includeHidden: true })
      .loginAs(brian)
    const hiddenNames = hiddenResponse.body().data.map((b: { name: string }) => b.name)
    assert.include(hiddenNames, 'Kayo')
    assert.include(hiddenNames, 'Nintendo')
    assert.include(hiddenNames, 'Cancelled')
  })
})

test.group('RecurringBills / store', () => {
  test('derives dueDay/dueMonth/dueYear from nextDueOn', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client.post('/api/recurring-bills').withCsrfToken().loginAs(brian).json({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      nextDueOn: '2026-01-31',
    })

    response.assertStatus(201)
    assert.equal(response.body().data.dueDay, 31)
    assert.equal(response.body().data.dueMonth, 1)
    assert.equal(response.body().data.dueYear, 2026)
  })

  test('rejects a custom frequency without its interval fields', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/recurring-bills')
      .withCsrfToken()
      .loginAs(brian)
      .json({ name: 'Fortnightly thing', amount: 10, frequency: 'custom', nextDueOn: '2026-01-01' })

    response.assertStatus(422)
  })
})

test.group('RecurringBills / update', () => {
  test('re-derives dueDay/dueMonth/dueYear when nextDueOn changes', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
      nextDueOn: DateTime.fromISO('2026-01-31'),
    })

    const response = await client
      .patch(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ nextDueOn: '2027-02-28' })

    response.assertStatus(200)
    assert.equal(response.body().data.dueDay, 28)
    assert.equal(response.body().data.dueMonth, 2)
    assert.equal(response.body().data.dueYear, 2027)
  })

  test('leaves dueDay/dueMonth/dueYear untouched when nextDueOn is not provided', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      dueDay: 31,
      dueMonth: 1,
      nextDueOn: DateTime.fromISO('2026-01-31'),
    })

    const response = await client
      .patch(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 70 })

    response.assertStatus(200)
    assert.equal(response.body().data.dueDay, 31)
    assert.equal(response.body().data.amount, 70)
  })

  test('archiving a bill clears an existing pause', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({ name: 'Kayo', amount: 45.99, frequency: 'monthly' })
    bill.isPaused = true
    await bill.save()

    const response = await client
      .patch(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ isArchived: true })

    response.assertStatus(200)
    assert.equal(response.body().data.isArchived, true)
    assert.equal(response.body().data.isPaused, false)
  })
})

test.group('RecurringBills / destroy', () => {
  test('rejects removing a bill that is not archived', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      nextDueOn: DateTime.fromISO('2026-01-31'),
    })

    const response = await client
      .delete(`/api/recurring-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(409)
    assert.isNotNull(await RecurringBill.find(bill.id))
  })

  test('permanently deletes an archived bill and its payment history', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Costco Membership',
      amount: 65,
      frequency: 'annual',
      nextDueOn: DateTime.fromISO('2026-01-31'),
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
      .loginAs(brian)

    response.assertStatus(204)
    assert.isNull(await RecurringBill.find(bill.id))
    assert.lengthOf(await RecurringBillPayment.query().where('recurringBillId', bill.id), 0)
  })
})

test.group('RecurringBills / upsertPayment', () => {
  test('creates a payment row marking the month paid', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paid)
    assert.equal(response.body().data.recurringBillId, bill.id)
  })

  test('updates the existing payment row for that month rather than duplicating it', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })
    await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: false })

    response.assertStatus(200)
    assert.isFalse(response.body().data.paid)
    const payments = await RecurringBillPayment.query().where('recurringBillId', bill.id)
    assert.lengthOf(payments, 1)
  })

  test('returns 404 for a non-existent recurring bill', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/recurring-bills/999999/payments/2026/3')
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    response.assertStatus(404)
  })

  test('rejects a non-boolean paid value', async ({ client }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      dueDay: 5,
    })

    const response = await client
      .put(`/api/recurring-bills/${bill.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: 'yes' })

    response.assertStatus(422)
  })
})

test.group('RecurringBills / upcoming', () => {
  test('flags bills due within 30 days and sorts soonest-first', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const today = DateTime.utc().startOf('day')
    await RecurringBill.create({
      name: 'Due in 60 days',
      amount: 10,
      frequency: 'annual',
      nextDueOn: today.plus({ days: 60 }),
    })
    await RecurringBill.create({
      name: 'Due in 10 days',
      amount: 10,
      frequency: 'annual',
      nextDueOn: today.plus({ days: 10 }),
    })
    await RecurringBill.create({
      name: 'No next due date',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: null,
    })

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(brian)

    response.assertStatus(200)
    const names = response.body().data.map((b: { name: string }) => b.name)
    assert.deepEqual(names, ['Due in 10 days', 'Due in 60 days', 'No next due date'])
    assert.isTrue(response.body().data[0].dueSoon)
    assert.isFalse(response.body().data[1].dueSoon)
    assert.isNull(response.body().data[2].daysUntilDue)
  })

  test('excludes inactive bills', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const bill = await RecurringBill.create({
      name: 'Cancelled thing',
      amount: 10,
      frequency: 'annual',
      nextDueOn: DateTime.utc().plus({ days: 5 }),
    })
    bill.isActive = false
    await bill.save()

    const response = await client.get('/api/recurring-bills/upcoming').loginAs(brian)

    assert.lengthOf(response.body().data, 0)
  })

  test('excludes paused and archived bills, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const paused = await RecurringBill.create({
      name: 'Kayo',
      amount: 45.99,
      frequency: 'monthly',
      nextDueOn: DateTime.utc().plus({ days: 5 }),
    })
    paused.isPaused = true
    await paused.save()
    const archived = await RecurringBill.create({
      name: 'Nintendo',
      amount: 29.95,
      frequency: 'annual',
      nextDueOn: DateTime.utc().plus({ days: 5 }),
    })
    archived.isArchived = true
    await archived.save()

    const defaultResponse = await client.get('/api/recurring-bills/upcoming').loginAs(brian)
    assert.lengthOf(defaultResponse.body().data, 0)

    const hiddenResponse = await client
      .get('/api/recurring-bills/upcoming')
      .qs({ includeHidden: true })
      .loginAs(brian)
    assert.lengthOf(hiddenResponse.body().data, 2)
  })
})
