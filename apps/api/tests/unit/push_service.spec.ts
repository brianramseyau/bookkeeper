import { test } from '@japa/runner'
import User from '#models/user'
import PushConfig from '#models/push_config'
import PushSubscription from '#models/push_subscription'
import {
  getPushConfig,
  getPushPublicKey,
  sendPushNotification,
  sendTestNotification,
} from '#services/push_service'
import {
  startFakePushServer,
  generateTestSubscriptionKeys,
  type FakePushServer,
} from '#tests/helpers/fake_push_server'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('getPushConfig', (group) => {
  group.each.teardown(async () => {
    await PushConfig.query().where('id', 1).delete()
  })

  test('generates and persists a VAPID key pair on first access', async ({ assert }) => {
    const config = await getPushConfig()

    assert.isString(config.publicKey)
    assert.isString(config.privateKey)
    assert.isNotEmpty(config.publicKey)
    assert.isNotEmpty(config.privateKey)
  })

  test('returns the same config on subsequent calls rather than regenerating it', async ({
    assert,
  }) => {
    const first = await getPushConfig()
    const second = await getPushConfig()

    assert.equal(second.publicKey, first.publicKey)
    assert.equal(second.privateKey, first.privateKey)
  })

  test('getPushPublicKey returns just the public key', async ({ assert }) => {
    const config = await getPushConfig()
    const publicKey = await getPushPublicKey()
    assert.equal(publicKey, config.publicKey)
  })
})

test.group('sendPushNotification', (group) => {
  let server: FakePushServer
  let originalTlsReject: string | undefined

  group.setup(async () => {
    // The fake server uses a throwaway self-signed cert - trust it for the
    // duration of this group rather than mocking the `web-push` module, so
    // the real send/error-handling code path is actually exercised.
    originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    server = await startFakePushServer()
    return async () => {
      await server.close()
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
    }
  })

  group.each.teardown(async () => {
    await PushConfig.query().where('id', 1).delete()
    await PushSubscription.query()
      .where('endpoint', 'like', server.url + '%')
      .delete()
  })

  async function createSubscription(id: number) {
    const adam = await loginAsAdam()
    const keys = generateTestSubscriptionKeys()
    return PushSubscription.create({
      userId: adam.id,
      endpoint: `${server.url}?sub=${id}`,
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })
  }

  test('returns pruned: false on a successful send', async ({ assert }) => {
    server.setResponseStatus(201)
    const subscription = await createSubscription(1)

    const outcome = await sendPushNotification(subscription, {
      title: 'Hi',
      body: 'body',
      url: '/',
    })

    assert.deepEqual(outcome, { pruned: false })
    assert.equal(server.getRequestCount(), 1)
  })

  test('deletes the subscription and returns pruned: true on a 410 Gone', async ({ assert }) => {
    server.setResponseStatus(410)
    const subscription = await createSubscription(2)

    const outcome = await sendPushNotification(subscription, {
      title: 'Hi',
      body: 'body',
      url: '/',
    })

    assert.deepEqual(outcome, { pruned: true })
    assert.isNull(await PushSubscription.find(subscription.id))
  })

  test('deletes the subscription and returns pruned: true on a 404', async ({ assert }) => {
    server.setResponseStatus(404)
    const subscription = await createSubscription(3)

    const outcome = await sendPushNotification(subscription, {
      title: 'Hi',
      body: 'body',
      url: '/',
    })

    assert.deepEqual(outcome, { pruned: true })
    assert.isNull(await PushSubscription.find(subscription.id))
  })

  test('propagates other errors rather than pruning', async ({ assert }) => {
    server.setResponseStatus(500)
    const subscription = await createSubscription(4)

    await assert.rejects(() =>
      sendPushNotification(subscription, { title: 'Hi', body: 'b', url: '/' })
    )
    assert.isNotNull(await PushSubscription.find(subscription.id))
  })

  test('sendTestNotification sends to every subscription the user has and counts outcomes', async ({
    assert,
  }) => {
    server.setResponseStatus(201)
    const adam = await loginAsAdam()
    await createSubscription(5)
    await createSubscription(6)

    const result = await sendTestNotification(adam.id)

    assert.equal(result.sent, 2)
    assert.equal(result.pruned, 0)
    assert.equal(result.failed, 0)
  })

  test('sendTestNotification counts a pruned subscription rather than a sent one', async ({
    assert,
  }) => {
    const adam = await loginAsAdam()
    await createSubscription(7)
    server.setResponseStatus(410)

    const result = await sendTestNotification(adam.id)

    assert.equal(result.sent, 0)
    assert.equal(result.pruned, 1)
    assert.equal(result.failed, 0)
  })

  test('sendTestNotification counts a failure rather than throwing, and keeps trying other devices', async ({
    assert,
  }) => {
    const adam = await loginAsAdam()
    await createSubscription(8)
    await createSubscription(9)
    server.setResponseStatus(500)
    server.resetRequestCount()

    const result = await sendTestNotification(adam.id)

    assert.equal(result.sent, 0)
    assert.equal(result.pruned, 0)
    assert.equal(result.failed, 2)
    assert.equal(server.getRequestCount(), 2)
  })
})
