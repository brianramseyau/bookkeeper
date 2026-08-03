import { test } from '@japa/runner'
import User from '#models/user'
import NotificationSchedule from '#models/notification_schedule'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('NotificationSchedule / show', () => {
  test('creates and returns the default (8am, never run) schedule on first access', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/notification-schedule').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.sendHour, 8)
    assert.isNull(response.body().data.lastRunAt)
  })

  test('returns the existing schedule rather than resetting it', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await NotificationSchedule.create({ id: 1, sendHour: 18 })

    const response = await client.get('/api/notification-schedule').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.sendHour, 18)
  })
})

test.group('NotificationSchedule / update', () => {
  test('updates the send hour', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/notification-schedule')
      .withCsrfToken()
      .loginAs(adam)
      .json({ sendHour: 20 })

    response.assertStatus(200)
    assert.equal(response.body().data.sendHour, 20)

    const stored = await NotificationSchedule.findOrFail(1)
    assert.equal(stored.sendHour, 20)
  })

  test('rejects an out-of-range sendHour', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/notification-schedule')
      .withCsrfToken()
      .loginAs(adam)
      .json({ sendHour: 24 })

    response.assertStatus(422)
  })
})
