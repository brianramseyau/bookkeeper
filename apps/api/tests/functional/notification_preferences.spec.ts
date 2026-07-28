import { test } from '@japa/runner'
import User from '#models/user'
import UserNotificationPreference from '#models/user_notification_preference'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

async function loginAsAriel() {
  return User.findByOrFail('fullName', 'Ariel')
}

test.group('NotificationPreferences / show', () => {
  test('creates and returns the default (disabled) preference for the current user', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/notification-preferences').loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, false)
    assert.equal(response.body().data.leadDays, 3)
    assert.equal(response.body().data.notifyUtilityBills, true)
    assert.equal(response.body().data.notifyRecurringBills, true)
    assert.equal(response.body().data.notifySubscriptions, true)
  })

  test("does not leak another user's preference", async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const ariel = await loginAsAriel()
    await UserNotificationPreference.create({ userId: ariel.id, enabled: true, leadDays: 10 })

    const response = await client.get('/api/notification-preferences').loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, false)
    assert.equal(response.body().data.leadDays, 3)
  })
})

test.group('NotificationPreferences / update', () => {
  test("updates the current user's own preference", async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/notification-preferences')
      .withCsrfToken()
      .loginAs(brian)
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

    const stored = await UserNotificationPreference.findByOrFail('userId', brian.id)
    assert.equal(stored.leadDays, 5)
  })

  test('rejects an out-of-range leadDays', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/notification-preferences')
      .withCsrfToken()
      .loginAs(brian)
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
    const brian = await loginAsBrian()

    const response = await client
      .put('/api/notification-preferences')
      .withCsrfToken()
      .loginAs(brian)
      .json({
        leadDays: 3,
        notifyUtilityBills: true,
        notifyRecurringBills: true,
        notifySubscriptions: true,
      })

    response.assertStatus(422)
  })
})
