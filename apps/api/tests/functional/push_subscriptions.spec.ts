import { test } from '@japa/runner'
import User from '#models/user'
import PushSubscription from '#models/push_subscription'
import PushConfig from '#models/push_config'
import {
  startFakePushServer,
  generateTestSubscriptionKeys,
  type FakePushServer,
} from '#tests/helpers/fake_push_server'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

async function loginAsEve() {
  return User.findByOrFail('fullName', 'Eve')
}

test.group('PushSubscriptions / publicKey', (group) => {
  group.each.teardown(async () => {
    await PushConfig.query().where('id', 1).delete()
  })

  test('returns a generated public key', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/push-public-key').loginAs(adam)

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
    const adam = await loginAsAdam()
    const eve = await loginAsEve()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: adam.id,
      endpoint: 'https://example.com/push/adam',
      p256Dh: keys.p256dh,
      auth: keys.auth,
      userAgent: 'Test Browser',
    })
    await PushSubscription.create({
      userId: eve.id,
      endpoint: 'https://example.com/push/eve',
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client.get('/api/push-subscriptions').loginAs(adam)

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
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(adam)
      .header('user-agent', 'Test Browser')
      .json({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', keys })

    response.assertStatus(200)
    const stored = await PushSubscription.findByOrFail(
      'endpoint',
      'https://fcm.googleapis.com/fcm/send/new'
    )
    assert.equal(stored.userId, adam.id)
    assert.equal(stored.userAgent, 'Test Browser')
  })

  test('re-subscribing the same endpoint updates rather than duplicates', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: adam.id,
      endpoint: 'https://fcm.googleapis.com/fcm/send/existing',
      p256Dh: 'stale',
      auth: 'stale',
    })

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(adam)
      .json({ endpoint: 'https://fcm.googleapis.com/fcm/send/existing', keys })

    response.assertStatus(200)
    const all = await PushSubscription.query().where(
      'endpoint',
      'https://fcm.googleapis.com/fcm/send/existing'
    )
    assert.lengthOf(all, 1)
    assert.equal(all[0].p256Dh, keys.p256dh)
  })

  test('rejects a payload missing keys', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(adam)
      .json({ endpoint: 'https://fcm.googleapis.com/fcm/send/incomplete' })

    response.assertStatus(422)
  })

  test('accepts an endpoint on a real push-service origin', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(adam)
      .json({ endpoint: 'https://web.push.apple.com/some-token', keys })

    response.assertStatus(200)
    assert.isNotNull(
      await PushSubscription.findBy('endpoint', 'https://web.push.apple.com/some-token')
    )
  })

  test('rejects an endpoint pointing at an internal address (SSRF)', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()

    const response = await client
      .post('/api/push-subscriptions')
      .withCsrfToken()
      .loginAs(adam)
      .json({ endpoint: 'http://192.168.1.1/admin', keys })

    response.assertStatus(422)
    assert.isNull(await PushSubscription.findBy('endpoint', 'http://192.168.1.1/admin'))
  })
})

test.group('PushSubscriptions / destroy', (group) => {
  group.each.teardown(async () => {
    await PushSubscription.query().delete()
  })

  test("deletes the current user's own subscription", async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()
    const subscription = await PushSubscription.create({
      userId: adam.id,
      endpoint: 'https://example.com/push/mine',
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client
      .delete(`/api/push-subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    assert.isNull(await PushSubscription.find(subscription.id))
  })

  test("returns 404 rather than deleting another user's subscription", async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    const eve = await loginAsEve()
    const keys = generateTestSubscriptionKeys()
    const subscription = await PushSubscription.create({
      userId: eve.id,
      endpoint: 'https://example.com/push/not-mine',
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client
      .delete(`/api/push-subscriptions/${subscription.id}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(404)
    assert.isNotNull(await PushSubscription.find(subscription.id))
  })

  test('returns 404 for a subscription id that does not exist', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .delete('/api/push-subscriptions/999999')
      .withCsrfToken()
      .loginAs(adam)

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
    const adam = await loginAsAdam()

    const response = await client.post('/api/push-subscriptions/test').withCsrfToken().loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().sent, 0)
    assert.equal(response.body().pruned, 0)
  })

  test('sends a real test push to a registered device', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: adam.id,
      endpoint: `${server.url}?test=1`,
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })

    const response = await client.post('/api/push-subscriptions/test').withCsrfToken().loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().sent, 1)
    assert.equal(server.getRequestCount(), 1)
  })

  test('reports a rejected device as failed rather than a 500', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()
    await PushSubscription.create({
      userId: adam.id,
      endpoint: `${server.url}?test=2`,
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })
    server.setResponseStatus(500)

    const response = await client.post('/api/push-subscriptions/test').withCsrfToken().loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().sent, 0)
    assert.equal(response.body().failed, 1)
  })
})
