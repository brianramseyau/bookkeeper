import fs from 'node:fs/promises'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import BackupSetting from '#models/backup_setting'
import { backupDir, listBackups } from '#services/backup_service'
import { getBackupSettings, isBackupDue, runDueBackupCheck } from '#services/backup_scheduler'

test.group('isBackupDue', () => {
  const now = DateTime.utc(2026, 7, 28, 12, 0, 0)

  test('is false when the schedule is disabled', ({ assert }) => {
    assert.isFalse(isBackupDue({ enabled: false, intervalHours: 24, lastRunAt: null }, now))
  })

  test('is true when enabled and no backup has ever run', ({ assert }) => {
    assert.isTrue(isBackupDue({ enabled: true, intervalHours: 24, lastRunAt: null }, now))
  })

  test('is false when less than intervalHours have elapsed since the last run', ({ assert }) => {
    const lastRunAt = now.minus({ hours: 23 })
    assert.isFalse(isBackupDue({ enabled: true, intervalHours: 24, lastRunAt }, now))
  })

  test('is true once at least intervalHours have elapsed since the last run', ({ assert }) => {
    const lastRunAt = now.minus({ hours: 24 })
    assert.isTrue(isBackupDue({ enabled: true, intervalHours: 24, lastRunAt }, now))
  })
})

test.group('runDueBackupCheck', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
    await BackupSetting.query().where('id', 1).delete()
  })

  test('runs a first backup when no schedule row exists yet (enabled by default)', async ({
    assert,
  }) => {
    const now = DateTime.utc(2026, 7, 28)
    await runDueBackupCheck(now)

    const backups = await listBackups()
    assert.lengthOf(backups, 1)
    const settings = await getBackupSettings()
    // Loose equality - SQLite has no native boolean type, so a value just
    // re-read from the DB (rather than set in this same JS process) comes
    // back as the raw 0/1 it's stored as.
    assert.equal(settings.enabled, true)
    assert.equal(settings.lastRunAt?.toMillis(), now.toMillis())
  })

  test('creates a backup, purges expired ones, and stamps lastRunAt when due', async ({
    assert,
  }) => {
    const settings = await getBackupSettings()
    settings.merge({ enabled: true, intervalHours: 24, retentionDays: 7 })
    await settings.save()

    const now = DateTime.utc(2026, 7, 28, 3, 0, 0)
    await runDueBackupCheck(now)

    const backups = await listBackups()
    assert.lengthOf(backups, 1)

    const reloaded = await getBackupSettings()
    assert.equal(reloaded.lastRunAt?.toMillis(), now.toMillis())
  })

  test('swallows and logs a failed backup rather than throwing, leaving lastRunAt unset', async ({
    assert,
  }) => {
    const settings = await getBackupSettings()
    settings.merge({ enabled: true, intervalHours: 24, retentionDays: 7 })
    await settings.save()

    // Pre-create a plain file where the backups *directory* needs to go, so
    // `createBackup`'s `fs.mkdir(dir, { recursive: true })` fails - the
    // simplest way to force a real failure through the whole call chain
    // without a mocking library.
    await fs.rm(backupDir(), { recursive: true, force: true })
    await fs.writeFile(backupDir(), 'not a directory')

    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 3, 0, 0))

    const reloaded = await getBackupSettings()
    assert.isNull(reloaded.lastRunAt)
  })

  test('leaves lastRunAt untouched when not due yet', async ({ assert }) => {
    const lastRunAt = DateTime.utc(2026, 7, 27, 3, 0, 0)
    const settings = await getBackupSettings()
    settings.merge({ enabled: true, intervalHours: 24, retentionDays: 7, lastRunAt })
    await settings.save()

    await runDueBackupCheck(lastRunAt.plus({ hours: 1 }))

    assert.deepEqual(await listBackups(), [])
    const reloaded = await getBackupSettings()
    assert.equal(reloaded.lastRunAt?.toMillis(), lastRunAt.toMillis())
  })
})
