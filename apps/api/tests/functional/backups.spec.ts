import fs from 'node:fs/promises'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import BackupSetting from '#models/backup_setting'
import { backupDir, createBackup } from '#services/backup_service'

async function loginAsAdam() {
  return User.findByOrFail('fullName', 'Adam')
}

test.group('Backups / index', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('returns an empty list when no backups exist yet', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.get('/api/backups').loginAs(adam)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [])
  })

  test('lists existing backups', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    await createBackup()

    const response = await client.get('/api/backups').loginAs(adam)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.match(response.body().data[0].filename, /^bookkeeper-backup-.*\.sqlite3$/)
    assert.isAbove(response.body().data[0].sizeBytes, 0)
  })
})

test.group('Backups / store', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
    await BackupSetting.query().where('id', 1).delete()
  })

  test('creates a new backup on demand, tagged manual', async ({ client, assert }) => {
    const adam = await loginAsAdam()

    const response = await client.post('/api/backups').withCsrfToken().loginAs(adam)

    response.assertStatus(201)
    assert.match(response.body().data.filename, /^bookkeeper-backup-manual-.*\.sqlite3$/)
    assert.equal(response.body().data.source, 'manual')
  })

  test('does not touch the automatic schedule or prune automatic backups', async ({
    client,
    assert,
  }) => {
    const adam = await loginAsAdam()
    // Retention count of 0 means any due check would prune every automatic
    // backup - a manual "Backup now" click must not trigger that.
    const oldAutomatic = await createBackup(DateTime.utc().minus({ days: 10 }))
    await BackupSetting.firstOrCreate(
      { id: 1 },
      { enabled: false, frequency: 'daily', timeOfDay: '01:00', retentionCount: 0 }
    )

    const response = await client.post('/api/backups').withCsrfToken().loginAs(adam)

    response.assertStatus(201)
    const listResponse = await client.get('/api/backups').loginAs(adam)
    assert.lengthOf(listResponse.body().data, 2)
    const filenames = listResponse.body().data.map((b: { filename: string }) => b.filename)
    assert.include(filenames, oldAutomatic.filename)
    assert.include(filenames, response.body().data.filename)
  })
})

test.group('Backups / destroy', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('deletes an existing backup', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const backup = await createBackup()

    const response = await client
      .delete(`/api/backups/${backup.filename}`)
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(204)
    const listResponse = await client.get('/api/backups').loginAs(adam)
    assert.deepEqual(listResponse.body().data, [])
  })

  test('returns 404 for a filename that does not exist', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .delete('/api/backups/bookkeeper-backup-20200101-000000.sqlite3')
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(404)
  })

  test('returns 404 rather than deleting an unsafe filename', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .delete('/api/backups/..%2F..%2Fetc%2Fpasswd')
      .withCsrfToken()
      .loginAs(adam)

    response.assertStatus(404)
  })
})

test.group('Backups / download', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('streams an existing backup file', async ({ client, assert }) => {
    const adam = await loginAsAdam()
    const backup = await createBackup()

    const response = await client.get(`/api/backups/${backup.filename}/download`).loginAs(adam)

    response.assertStatus(200)
    assert.include(response.header('content-length'), String(backup.sizeBytes))
  })

  test('returns 404 for a filename that does not exist', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .get('/api/backups/bookkeeper-backup-20200101-000000.sqlite3/download')
      .loginAs(adam)

    response.assertStatus(404)
  })

  test('returns 404 rather than streaming an unsafe filename', async ({ client }) => {
    const adam = await loginAsAdam()

    const response = await client
      .get('/api/backups/not-a-real-backup.sqlite3/download')
      .loginAs(adam)

    response.assertStatus(404)
  })
})
