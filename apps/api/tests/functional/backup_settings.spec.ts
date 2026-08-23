import { test } from '@japa/runner'
import User from '#models/user'
import BackupSetting from '#models/backup_setting'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('BackupSettings / show', () => {
  test('creates and returns the default (enabled, daily) schedule on first access', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/backup-settings').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, true)
    assert.equal(response.body().data.frequency, 'daily')
    assert.equal(response.body().data.timeOfDay, '01:00')
    assert.equal(response.body().data.retentionCount, 7)
  })

  test('returns the existing schedule rather than resetting it', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await BackupSetting.create({
      id: 1,
      enabled: true,
      frequency: 'weekly',
      timeOfDay: '03:00',
      retentionCount: 14,
    })

    const response = await client.get('/api/backup-settings').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, true)
    assert.equal(response.body().data.frequency, 'weekly')
    assert.equal(response.body().data.timeOfDay, '03:00')
    assert.equal(response.body().data.retentionCount, 14)
  })
})

test.group('BackupSettings / update', () => {
  test('updates the schedule', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, frequency: 'monthly', timeOfDay: '03:30', retentionCount: 30 })

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, true)
    assert.equal(response.body().data.frequency, 'monthly')
    assert.equal(response.body().data.timeOfDay, '03:30')
    assert.equal(response.body().data.retentionCount, 30)

    const stored = await BackupSetting.findOrFail(1)
    assert.equal(stored.frequency, 'monthly')
    assert.equal(stored.timeOfDay, '03:30')
  })

  test('rejects an invalid frequency', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, frequency: 'hourly', timeOfDay: '01:00', retentionCount: 7 })

    response.assertStatus(422)
  })

  test('rejects a malformed timeOfDay', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, frequency: 'daily', timeOfDay: '25:00', retentionCount: 7 })

    response.assertStatus(422)
  })

  test('rejects an out-of-range retentionCount', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, frequency: 'daily', timeOfDay: '01:00', retentionCount: 0 })

    response.assertStatus(422)
  })

  test('rejects a missing enabled flag', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ frequency: 'daily', timeOfDay: '01:00', retentionCount: 7 })

    response.assertStatus(422)
  })
})
