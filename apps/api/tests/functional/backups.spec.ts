import fs from 'node:fs/promises'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import BackupSetting from '#models/backup_setting'
import { backupDir, createBackup } from '#services/backup_service'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('Backups / index', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('returns an empty list when no backups exist yet', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/backups').loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [])
  })

  test('lists existing backups', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await createBackup()

    const response = await client.get('/api/backups').loginAs(brian)

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

  test('creates a new backup on demand', async ({ client, assert }) => {
    const brian = await loginAsBrian()

    const response = await client.post('/api/backups').withCsrfToken().loginAs(brian)

    response.assertStatus(201)
    assert.match(response.body().data.filename, /^bookkeeper-backup-.*\.sqlite3$/)
  })

  test('also purges expired backups and stamps lastRunAt', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    await createBackup(DateTime.utc().minus({ days: 10 }))
    await BackupSetting.firstOrCreate(
      { id: 1 },
      { enabled: false, intervalHours: 24, retentionDays: 7 }
    )

    const response = await client.post('/api/backups').withCsrfToken().loginAs(brian)

    response.assertStatus(201)
    // retentionDays 7 means the 10-day-old pre-existing backup is expired -
    // only the fresh one from this request should remain.
    const listResponse = await client.get('/api/backups').loginAs(brian)
    assert.lengthOf(listResponse.body().data, 1)
    assert.equal(listResponse.body().data[0].filename, response.body().data.filename)

    const reloaded = await BackupSetting.findOrFail(1)
    assert.isNotNull(reloaded.lastRunAt)
  })
})

test.group('Backups / destroy', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('deletes an existing backup', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const backup = await createBackup()

    const response = await client
      .delete(`/api/backups/${backup.filename}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const listResponse = await client.get('/api/backups').loginAs(brian)
    assert.deepEqual(listResponse.body().data, [])
  })

  test('returns 404 for a filename that does not exist', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .delete('/api/backups/bookkeeper-backup-20200101-000000.sqlite3')
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(404)
  })

  test('returns 404 rather than deleting an unsafe filename', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .delete('/api/backups/..%2F..%2Fetc%2Fpasswd')
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(404)
  })
})

test.group('Backups / download', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('streams an existing backup file', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const backup = await createBackup()

    const response = await client.get(`/api/backups/${backup.filename}/download`).loginAs(brian)

    response.assertStatus(200)
    assert.include(response.header('content-length'), String(backup.sizeBytes))
  })

  test('returns 404 for a filename that does not exist', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .get('/api/backups/bookkeeper-backup-20200101-000000.sqlite3/download')
      .loginAs(brian)

    response.assertStatus(404)
  })

  test('returns 404 rather than streaming an unsafe filename', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client
      .get('/api/backups/not-a-real-backup.sqlite3/download')
      .loginAs(brian)

    response.assertStatus(404)
  })
})
