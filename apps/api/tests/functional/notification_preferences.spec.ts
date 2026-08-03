import { test } from '@japa/runner'
import User from '#models/user'
import UserNotificationPreference from '#models/user_notification_preference'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

async function loginAsEve() {
  return User.findByOrFail('fullName', 'Eve')
}

test.group('NotificationPreferences / show', () => {
  test('creates and returns the default (disabled) preference for the current user', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/notification-preferences').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, false)
    assert.equal(response.body().data.leadDays, 3)
    assert.equal(response.body().data.notifyUtilityBills, true)
    assert.equal(response.body().data.notifyRecurringBills, true)
    assert.equal(response.body().data.notifySubscriptions, true)
  })

  test("does not leak another user's preference", async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const eve = await loginAsEve()
    await UserNotificationPreference.create({ userId: eve.id, enabled: true, leadDays: 10 })

    const response = await client.get('/api/notification-preferences').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, false)
    assert.equal(response.body().data.leadDays, 3)
  })
})

test.group('NotificationPreferences / update', () => {
  test("updates the current user's own preference", async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/notification-preferences')
      .withCsrfToken()
      .loginAs(adam)
      .json({
        enabled: true,
        leadDays: 5,
        notifyUtilityBills: false,
        notifyRecurringBills: true,
        notifySubscriptions: false,
      })

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, true)
    assert.equal(response.body().data.leadDays, 5)
    assert.equal(response.body().data.notifyUtilityBills, false)
    assert.equal(response.body().data.notifySubscriptions, false)

    const stored = await UserNotificationPreference.findByOrFail('userId', adam.id)
    assert.equal(stored.leadDays, 5)
  })

  test('rejects an out-of-range leadDays', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/notification-preferences')
      .withCsrfToken()
      .loginAs(adam)
      .json({
        enabled: true,
        leadDays: 31,
        notifyUtilityBills: true,
        notifyRecurringBills: true,
        notifySubscriptions: true,
      })

    response.assertStatus(422)
  })

  test('rejects a missing enabled flag', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/notification-preferences')
      .withCsrfToken()
      .loginAs(adam)
      .json({
        leadDays: 3,
        notifyUtilityBills: true,
        notifyRecurringBills: true,
        notifySubscriptions: true,
      })

    response.assertStatus(422)
  })
})
