import { test } from '@japa/runner'
import User from '#models/user'
import PushSubscription from '#models/push_subscription'
import PushConfig from '#models/push_config'
import {
  startFakePushServer,
  generateTestSubscriptionKeys,
  type FakePushServer,
} from '#tests/helpers/fake_push_server'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

async function loginAsAriel() {
  return User.findByOrFail('fullName', 'Ariel')
}

test.group('PushSubscriptions / publicKey', (group) => {
  group.each.teardown(async () => {
    await PushConfig.query().where('id', 1).delete()
  })

  test('returns a generated public key', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/push-public-key').loginAs(brian)

    response.assertStatus(200)
    assert.isString(response.body().publicKey)
    assert.isNotEmpty(response.body().publicKey)
  })
})

test.group('PushSubscriptions / index', (group) => {
  group.each.teardown(async () => {
    await PushSubscription.query().delete()
  })

  test("lists only the current user's own subscriptions", async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const ariel = await loginAsAriel()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: brian.id,
      endpoint: 'https://example.com/push/brian',
      p256Dh: keys.p256dh,
      auth: keys.auth,
      userAgent: 'Test Browser',
    })
    await PushSubscription.create({
      userId: ariel.id,
      endpoint: 'https://example.com/push/ariel',
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client.get('/api/push-subscriptions').loginAs(brian)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].userAgent, 'Test Browser')
    assert.notProperty(response.body().data[0], 'p256Dh')
    assert.notProperty(response.body().data[0], 'auth')
  })
})

test.group('PushSubscriptions / store', (group) => {
  group.each.teardown(async () => {
    await PushSubscription.query().delete()
  })

  test('registers a new subscription for the current user', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const keys = generateTestSubscriptionKeys()

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(brian)
      .header('user-agent', 'Test Browser')
      .json({ endpoint: 'https://example.com/push/new', keys })

    response.assertStatus(200)
    const stored = await PushSubscription.findByOrFail('endpoint', 'https://example.com/push/new')
    assert.equal(stored.userId, brian.id)
    assert.equal(stored.userAgent, 'Test Browser')
  })

  test('re-subscribing the same endpoint updates rather than duplicates', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: brian.id,
      endpoint: 'https://example.com/push/existing',
      p256Dh: 'stale',
      auth: 'stale',
    })

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(brian)
      .json({ endpoint: 'https://example.com/push/existing', keys })

    response.assertStatus(200)
    const all = await PushSubscription.query().where(
      'endpoint',
      'https://example.com/push/existing'
    )
    assert.lengthOf(all, 1)
    assert.equal(all[0].p256Dh, keys.p256dh)
  })

  test('rejects a payload missing keys', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(brian)
      .json({ endpoint: 'https://example.com/push/incomplete' })

    response.assertStatus(422)
  })
})

test.group('PushSubscriptions / destroy', (group) => {
  group.each.teardown(async () => {
    await PushSubscription.query().delete()
  })

  test("deletes the current user's own subscription", async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const keys = generateTestSubscriptionKeys()
    const subscription = await PushSubscription.create({
      userId: brian.id,
      endpoint: 'https://example.com/push/mine',
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client
      .delete(`/api/push-subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    assert.isNull(await PushSubscription.find(subscription.id))
  })

  test("returns 404 rather than deleting another user's subscription", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const ariel = await loginAsAriel()
    const keys = generateTestSubscriptionKeys()
    const subscription = await PushSubscription.create({
      userId: ariel.id,
      endpoint: 'https://example.com/push/not-mine',
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client
      .delete(`/api/push-subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(404)
    assert.isNotNull(await PushSubscription.find(subscription.id))
  })

  test('returns 404 for a subscription id that does not exist', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .delete('/api/push-subscriptions/999999')
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(404)
  })
})

test.group('PushSubscriptions / test', (group) => {
  let server: FakePushServer
  let originalTlsReject: string | undefined

  group.setup(async () => {
    originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    server = await startFakePushServer()
    return async () => {
      await server.close()
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
    }
  })

  group.each.teardown(async () => {
    await PushSubscription.query().delete()
    await PushConfig.query().where('id', 1).delete()
  })

  test('returns zero counts when the user has no registered devices', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const response = await client
      .post('/api/push-subscriptions/test')
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().sent, 0)
    assert.equal(response.body().pruned, 0)
  })

  test('sends a real test push to a registered device', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: brian.id,
      endpoint: `${server.url}?test=1`,
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client
      .post('/api/push-subscriptions/test')
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().sent, 1)
    assert.equal(server.getRequestCount(), 1)
  })
})
