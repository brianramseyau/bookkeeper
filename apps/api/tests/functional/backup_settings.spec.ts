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
    assert.equal(response.body().data.intervalHours, 24)
    assert.equal(response.body().data.retentionDays, 7)
    assert.equal(response.body().data.runHour, 1)
    assert.isNull(response.body().data.lastRunAt)
  })

  test('returns the existing schedule rather than resetting it', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await BackupSetting.create({ id: 1, enabled: true, intervalHours: 12, retentionDays: 14 })

    const response = await client.get('/api/backup-settings').loginAs(adam)

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, true)
    assert.equal(response.body().data.intervalHours, 12)
    assert.equal(response.body().data.retentionDays, 14)
  })
})

test.group('BackupSettings / update', () => {
  test('updates the schedule', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, intervalHours: 48, retentionDays: 30, runHour: 3 })

    response.assertStatus(200)
    assert.equal(response.body().data.enabled, true)
    assert.equal(response.body().data.intervalHours, 48)
    assert.equal(response.body().data.retentionDays, 30)
    assert.equal(response.body().data.runHour, 3)

    const stored = await BackupSetting.findOrFail(1)
    assert.equal(stored.intervalHours, 48)
    assert.equal(stored.runHour, 3)
  })

  test('rejects an out-of-range retentionDays', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, intervalHours: 24, retentionDays: 0, runHour: 1 })

    response.assertStatus(422)
  })

  test('rejects an out-of-range runHour', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ enabled: true, intervalHours: 24, retentionDays: 7, runHour: 24 })

    response.assertStatus(422)
  })

  test('rejects a missing enabled flag', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .put('/api/backup-settings')
      .withCsrfToken()
      .loginAs(adam)
      .json({ intervalHours: 24, retentionDays: 7, runHour: 1 })

    response.assertStatus(422)
  })
})
