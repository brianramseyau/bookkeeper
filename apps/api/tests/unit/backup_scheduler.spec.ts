import fs from 'node:fs/promises'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import BackupSetting from '#models/backup_setting'
import { backupDir, createBackup, listBackups } from '#services/backup_service'
import {
  currentPeriodStart,
  getBackupSettings,
  isBackupDue,
  runDueBackupCheck,
} from '#services/backup_scheduler'

test.group('currentPeriodStart', () => {
  test('daily: today at the anchor time when now is after it, yesterday when before', ({
    assert,
  }) => {
    assert.equal(
      currentPeriodStart('daily', '01:00', DateTime.utc(2026, 7, 28, 12, 0)).toISO(),
      DateTime.utc(2026, 7, 28, 1, 0).toISO()
    )
    assert.equal(
      currentPeriodStart('daily', '01:00', DateTime.utc(2026, 7, 28, 0, 30)).toISO(),
      DateTime.utc(2026, 7, 27, 1, 0).toISO()
    )
  })

  test('weekly: anchored to Sunday at the configured time', ({ assert }) => {
    // 2026-07-28 is a Tuesday; the most recent Sunday is 2026-07-26.
    assert.equal(
      currentPeriodStart('weekly', '01:00', DateTime.utc(2026, 7, 28, 12, 0)).toISO(),
      DateTime.utc(2026, 7, 26, 1, 0).toISO()
    )
    // Checked on the anchor Sunday itself, before the configured time -
    // rolls back to the previous Sunday.
    assert.equal(
      currentPeriodStart('weekly', '01:00', DateTime.utc(2026, 7, 26, 0, 30)).toISO(),
      DateTime.utc(2026, 7, 19, 1, 0).toISO()
    )
  })

  test('monthly: anchored to the 1st at the configured time', ({ assert }) => {
    assert.equal(
      currentPeriodStart('monthly', '01:00', DateTime.utc(2026, 7, 28, 12, 0)).toISO(),
      DateTime.utc(2026, 7, 1, 1, 0).toISO()
    )
    // Before the 1st's anchor time - rolls back to the previous month's 1st.
    assert.equal(
      currentPeriodStart('monthly', '01:00', DateTime.utc(2026, 7, 1, 0, 30)).toISO(),
      DateTime.utc(2026, 6, 1, 1, 0).toISO()
    )
  })
})

test.group('isBackupDue', () => {
  const now = DateTime.utc(2026, 7, 28, 12, 0, 0)

  test('is false when the schedule is disabled', ({ assert }) => {
    assert.isFalse(
      isBackupDue({ enabled: false, frequency: 'daily', timeOfDay: '01:00' }, null, now)
    )
  })

  test('is true when enabled and no backup has ever run, and no creation time is given', ({
    assert,
  }) => {
    assert.isTrue(isBackupDue({ enabled: true, frequency: 'daily', timeOfDay: '01:00' }, null, now))
  })

  test('waits for the first period boundary after the schedule was created, rather than backdating', ({
    assert,
  }) => {
    // Schedule created at 6am today; today's 1am period start already
    // elapsed before the schedule even existed, so it must not fire yet.
    const createdAt = DateTime.utc(2026, 7, 28, 6, 0, 0)
    assert.isFalse(
      isBackupDue(
        { enabled: true, frequency: 'daily', timeOfDay: '01:00' },
        null,
        DateTime.utc(2026, 7, 28, 12, 0, 0),
        createdAt
      )
    )
    // Once tomorrow's 1am period start has been reached, it's due.
    assert.isTrue(
      isBackupDue(
        { enabled: true, frequency: 'daily', timeOfDay: '01:00' },
        null,
        DateTime.utc(2026, 7, 29, 1, 0, 0),
        createdAt
      )
    )
  })

  test('is false when the last automatic backup already covers the current period', ({
    assert,
  }) => {
    const lastAutomaticAt = DateTime.utc(2026, 7, 28, 3, 0, 0)
    assert.isFalse(
      isBackupDue({ enabled: true, frequency: 'daily', timeOfDay: '01:00' }, lastAutomaticAt, now)
    )
  })

  test('is true once now has reached a period start after the last automatic backup', ({
    assert,
  }) => {
    const lastAutomaticAt = DateTime.utc(2026, 7, 27, 1, 0, 0)
    assert.isTrue(
      isBackupDue({ enabled: true, frequency: 'daily', timeOfDay: '01:00' }, lastAutomaticAt, now)
    )
  })

  test('is false before the anchor time has been reached for the day', ({ assert }) => {
    const earlyMorning = DateTime.utc(2026, 7, 28, 0, 30, 0)
    const lastAutomaticAt = DateTime.utc(2026, 7, 27, 1, 0, 0)
    assert.isFalse(
      isBackupDue(
        { enabled: true, frequency: 'daily', timeOfDay: '01:00' },
        lastAutomaticAt,
        earlyMorning
      )
    )
  })

  test('does not drift regardless of when the last backup actually fired', ({ assert }) => {
    // Fired late, at 1:04am - still counts as covering today's period.
    const lastAutomaticAt = DateTime.utc(2026, 7, 28, 1, 4, 0)
    assert.isFalse(
      isBackupDue(
        { enabled: true, frequency: 'daily', timeOfDay: '01:00' },
        lastAutomaticAt,
        DateTime.utc(2026, 7, 28, 23, 59, 0)
      )
    )
    assert.isTrue(
      isBackupDue(
        { enabled: true, frequency: 'daily', timeOfDay: '01:00' },
        lastAutomaticAt,
        DateTime.utc(2026, 7, 29, 1, 0, 0)
      )
    )
  })
})

test.group('runDueBackupCheck', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
    await BackupSetting.query().where('id', 1).delete()
  })

  test('creates the default (enabled, daily) schedule row on first access', async ({ assert }) => {
    const settings = await getBackupSettings()
    // Loose equality - SQLite has no native boolean type, so a value just
    // re-read from the DB (rather than set in this same JS process) comes
    // back as the raw 0/1 it's stored as.
    assert.equal(settings.enabled, true)
    assert.equal(settings.frequency, 'daily')
    assert.equal(settings.timeOfDay, '01:00')
    assert.equal(settings.retentionCount, 7)
  })

  test('does not backdate a freshly-created schedule to an already-elapsed period', async ({
    assert,
  }) => {
    // The schedule (daily, 1am) is created at 6am - today's 1am period is
    // already in the past, but it must wait for tomorrow's rather than
    // firing immediately.
    await BackupSetting.create({
      id: 1,
      enabled: true,
      frequency: 'daily',
      timeOfDay: '01:00',
      retentionCount: 7,
      createdAt: DateTime.utc(2026, 7, 28, 6, 0, 0),
    })

    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 12, 0, 0))

    assert.deepEqual(await listBackups(), [])
  })

  test('fires the first backup once the first period boundary after creation arrives', async ({
    assert,
  }) => {
    await BackupSetting.create({
      id: 1,
      enabled: true,
      frequency: 'daily',
      timeOfDay: '01:00',
      retentionCount: 7,
      createdAt: DateTime.utc(2026, 7, 28, 6, 0, 0),
    })

    await runDueBackupCheck(DateTime.utc(2026, 7, 29, 1, 0, 0))

    assert.lengthOf(await listBackups(), 1)
  })

  test('creates a backup and prunes down to the retention count when due', async ({ assert }) => {
    const settings = await getBackupSettings()
    settings.merge({ enabled: true, frequency: 'daily', timeOfDay: '01:00', retentionCount: 2 })
    await settings.save()

    await createBackup(DateTime.utc(2026, 7, 25, 1, 0, 0))
    await createBackup(DateTime.utc(2026, 7, 26, 1, 0, 0))
    await createBackup(DateTime.utc(2026, 7, 27, 1, 0, 0))

    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 1, 0, 0))

    const backups = await listBackups()
    // Pruned to the retention count of 2: the new backup plus the newest of
    // the 3 pre-existing ones.
    assert.lengthOf(backups, 2)
    assert.equal(backups[0]!.filename, 'bookkeeper-backup-auto-20260728-010000.sqlite3')
    assert.equal(backups[1]!.filename, 'bookkeeper-backup-auto-20260727-010000.sqlite3')
  })

  test('swallows and logs a failed backup rather than throwing', async ({ assert }) => {
    const settings = await getBackupSettings()
    settings.merge({ enabled: true, frequency: 'daily', timeOfDay: '01:00', retentionCount: 7 })
    await settings.save()

    // Pre-create a plain file where the backups *directory* needs to go, so
    // `createBackup`'s `fs.mkdir(dir, { recursive: true })` fails - the
    // simplest way to force a real failure through the whole call chain
    // without a mocking library.
    await fs.rm(backupDir(), { recursive: true, force: true })
    await fs.writeFile(backupDir(), 'not a directory')

    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 1, 0, 0))

    await fs.rm(backupDir(), { force: true })
    assert.deepEqual(await listBackups(), [])
  })

  test('leaves backups untouched when not due yet', async ({ assert }) => {
    const settings = await getBackupSettings()
    settings.merge({ enabled: true, frequency: 'daily', timeOfDay: '01:00', retentionCount: 7 })
    await settings.save()
    await createBackup(DateTime.utc(2026, 7, 28, 1, 0, 0))

    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 5, 0, 0))

    assert.lengthOf(await listBackups(), 1)
  })

  test('fires once per day at the anchored time regardless of poll jitter', async ({ assert }) => {
    await BackupSetting.create({
      id: 1,
      enabled: true,
      frequency: 'daily',
      timeOfDay: '01:00',
      retentionCount: 7,
      createdAt: DateTime.utc(2026, 1, 1),
    })

    // Simulate the periodic poll loop landing at slightly different offsets
    // past 1am on three separate days - this is exactly the jitter that used
    // to make the old lastRunAt-based schedule drift around the clock.
    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 1, 4, 0))
    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 1, 19, 0)) // same day, already ran
    await runDueBackupCheck(DateTime.utc(2026, 7, 29, 1, 11, 0))
    await runDueBackupCheck(DateTime.utc(2026, 7, 30, 0, 58, 0)) // before the anchor time

    const backups = await listBackups()
    assert.lengthOf(backups, 2)
  })

  test('is a no-op when disabled', async ({ assert }) => {
    const settings = await getBackupSettings()
    settings.merge({ enabled: false, frequency: 'daily', timeOfDay: '01:00', retentionCount: 7 })
    await settings.save()

    await runDueBackupCheck(DateTime.utc(2026, 7, 28, 1, 0, 0))

    assert.deepEqual(await listBackups(), [])
  })
})
