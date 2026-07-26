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
})

test.group('Subscriptions / destroy', () => {
  test('soft-deletes a subscription', async ({ client, assert }) => {
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

    response.assertStatus(204)
    const reloaded = await UserSubscription.findOrFail(subscription.id)
    assert.equal(reloaded.isActive, false)
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
    assert.equal(response.body().data.userSubscriptionId, subscription.id)
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
})
