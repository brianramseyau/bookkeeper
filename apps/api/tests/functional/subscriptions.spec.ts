import { test } from '@japa/runner'
import User from '#models/user'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('Subscriptions / index', () => {
  test('lists all subscriptions ordered by name', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await UserSubscription.create({ userId: brian.id, name: 'Netflix', amount: 22.99 })
    await UserSubscription.create({ userId: brian.id, name: 'Adobe', amount: 9.99 })

    const response = await client.get('/api/subscriptions').loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((s: { name: string }) => s.name),
      ['Adobe', 'Netflix']
    )
  })

  test('filters by userId when given', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const ariel = await User.findByOrFail('fullName', 'Ariel')
    await UserSubscription.create({ userId: brian.id, name: 'Netflix', amount: 22.99 })
    await UserSubscription.create({ userId: ariel.id, name: 'Spotify', amount: 12.99 })

    const response = await client.get('/api/subscriptions').qs({ userId: ariel.id }).loginAs(brian)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].name, 'Spotify')
  })

  test('excludes paused, archived, and removed subscriptions by default, but includes them with includeHidden', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const paused = await UserSubscription.create({ userId: brian.id, name: 'Kayo', amount: 45.99 })
    paused.isPaused = true
    await paused.save()
    const archived = await UserSubscription.create({
      userId: brian.id,
      name: 'Nintendo Online',
      amount: 3.99,
    })
    archived.isArchived = true
    await archived.save()
    const removed = await UserSubscription.create({
      userId: brian.id,
      name: 'Cancelled',
      amount: 10,
    })
    removed.isActive = false
    await removed.save()

    const defaultResponse = await client.get('/api/subscriptions').loginAs(brian)
    const defaultNames = defaultResponse.body().data.map((s: { name: string }) => s.name)
    assert.notInclude(defaultNames, 'Kayo')
    assert.notInclude(defaultNames, 'Nintendo Online')
    assert.notInclude(defaultNames, 'Cancelled')

    const hiddenResponse = await client
      .get('/api/subscriptions')
      .qs({ includeHidden: true })
      .loginAs(brian)
    const hiddenNames = hiddenResponse.body().data.map((s: { name: string }) => s.name)
    assert.include(hiddenNames, 'Kayo')
    assert.include(hiddenNames, 'Nintendo Online')
    assert.include(hiddenNames, 'Cancelled')
  })
})

test.group('Subscriptions / store', () => {
  test('creates a subscription', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/subscriptions')
      .withCsrfToken()
      .loginAs(brian)
      .json({ userId: brian.id, name: 'Netflix', amount: 22.99 })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Netflix')
  })
})

test.group('Subscriptions / update', () => {
  test('updates a subscription', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .patch(`/api/subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 24.99 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 24.99)
  })

  test('archiving a subscription clears an existing pause', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Kayo',
      amount: 45.99,
    })
    subscription.isPaused = true
    await subscription.save()

    const response = await client
      .patch(`/api/subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ isArchived: true })

    response.assertStatus(200)
    assert.equal(response.body().data.isArchived, true)
    assert.equal(response.body().data.isPaused, false)
  })
})

test.group('Subscriptions / destroy', () => {
  test('rejects removing a subscription that is not archived', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .delete(`/api/subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(409)
    assert.isNotNull(await UserSubscription.find(subscription.id))
  })

  test('permanently deletes an archived subscription and its payment history', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })
    subscription.isArchived = true
    await subscription.save()
    await SubscriptionPayment.create({
      userSubscriptionId: subscription.id,
      year: 2026,
      month: 1,
      paid: true,
    })

    const response = await client
      .delete(`/api/subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    assert.isNull(await UserSubscription.find(subscription.id))
    assert.lengthOf(
      await SubscriptionPayment.query().where('userSubscriptionId', subscription.id),
      0
    )
  })
})

test.group('Subscriptions / upsertPayment', () => {
  test('creates a payment row marking the month paid', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paid)
    assert.isNull(response.body().data.amount)
    assert.equal(response.body().data.userSubscriptionId, subscription.id)
  })

  test('creates a payment row with an explicit amount override, defaulting paid to false', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 24.99 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 24.99)
    assert.isFalse(response.body().data.paid)
  })

  test('updating paid alone does not clear a previously saved amount override', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })
    await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 24.99 })

    const response = await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    response.assertStatus(200)
    assert.isTrue(response.body().data.paid)
    assert.equal(response.body().data.amount, 24.99)
  })

  test('updating amount alone does not clear a previously saved paid flag', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })
    await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    const response = await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 24.99 })

    response.assertStatus(200)
    assert.equal(response.body().data.paid, true)
    assert.equal(response.body().data.amount, 24.99)
  })

  test('updates the existing payment row for that month rather than duplicating it', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })
    await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    const response = await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: false })

    response.assertStatus(200)
    assert.isFalse(response.body().data.paid)
    const payments = await SubscriptionPayment.query().where('userSubscriptionId', subscription.id)
    assert.lengthOf(payments, 1)
  })

  test('returns 404 for a non-existent subscription', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/subscriptions/999999/payments/2026/3')
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: true })

    response.assertStatus(404)
  })

  test('rejects a non-boolean paid value', async ({ client }) => {
    const brian = await loginAsBrian()
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 22.99,
    })

    const response = await client
      .put(`/api/subscriptions/${subscription.id}/payments/2026/3`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ paid: 'yes' })

    response.assertStatus(422)
  })
})

test.group('Subscriptions / summary', () => {
  test("sums active subscriptions per user, matching the source sheets' totals", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const ariel = await User.findByOrFail('fullName', 'Ariel')
    await UserSubscription.create({ userId: brian.id, name: 'Netflix', amount: 22.99 })
    await UserSubscription.create({ userId: brian.id, name: 'Adobe', amount: 15.48 })
    await UserSubscription.create({ userId: ariel.id, name: 'Spotify', amount: 26.48 })
    const cancelled = await UserSubscription.create({
      userId: brian.id,
      name: 'Old thing',
      amount: 100,
    })
    cancelled.isActive = false
    await cancelled.save()

    const response = await client.get('/api/subscriptions/summary').loginAs(brian)

    response.assertStatus(200)
    const brianSummary = response
      .body()
      .data.find((s: { fullName: string }) => s.fullName === 'Brian')
    const arielSummary = response
      .body()
      .data.find((s: { fullName: string }) => s.fullName === 'Ariel')
    assert.equal(brianSummary.total, 38.47)
    assert.equal(brianSummary.count, 2)
    assert.equal(arielSummary.total, 26.48)
  })

  test('excludes paused and archived subscriptions from the total', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await UserSubscription.create({ userId: brian.id, name: 'Netflix', amount: 22.99 })
    const paused = await UserSubscription.create({ userId: brian.id, name: 'Kayo', amount: 45.99 })
    paused.isPaused = true
    await paused.save()
    const archived = await UserSubscription.create({
      userId: brian.id,
      name: 'Nintendo Online',
      amount: 3.99,
    })
    archived.isArchived = true
    await archived.save()

    const response = await client.get('/api/subscriptions/summary').loginAs(brian)

    const brianSummary = response
      .body()
      .data.find((s: { fullName: string }) => s.fullName === 'Brian')
    assert.equal(brianSummary.total, 22.99)
    assert.equal(brianSummary.count, 1)
  })
})
