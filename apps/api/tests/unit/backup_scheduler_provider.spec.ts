import fs from 'node:fs/promises'
import { test } from '@japa/runner'
import type { AppEnvironments } from '@adonisjs/core/types/app'
import BackupSchedulerProvider from '#providers/backup_scheduler_provider'
import BackupSetting from '#models/backup_setting'
import { backupDir } from '#services/backup_service'

function fakeApp(environment: AppEnvironments) {
  return { getEnvironment: () => environment } as never
}

test.group('BackupSchedulerProvider', (group) => {
  group.each.teardown(async () => {
    // tick() runs the real (enabled-by-default) due-backup check, so it can
    // create a real backup file/settings row - clean up after it.
    await fs.rm(backupDir(), { recursive: true, force: true })
    await BackupSetting.query().where('id', 1).delete()
  })

  test('tick() runs the due-backup check directly (used by tests and the real timer callback)', async ({
    assert,
  }) => {
    const provider = new BackupSchedulerProvider(fakeApp('test'))
    // Doesn't throw, and creates the default (enabled) schedule row plus a
    // backup on first run - runDueBackupCheck itself is exercised in depth
    // by backup_scheduler.spec.ts.
    await provider.tick()
    assert.isTrue(true)
  })

  test('ready() does not schedule anything outside the "web" environment', async ({ assert }) => {
    const provider = new BackupSchedulerProvider(fakeApp('test'))

    await provider.ready()

    assert.isFalse(provider.isScheduled())
    await provider.shutdown()
  })

  test('ready() schedules the periodic check when running as the server', async ({ assert }) => {
    const provider = new BackupSchedulerProvider(fakeApp('web'))

    await provider.ready()

    assert.isTrue(provider.isScheduled())
    await provider.shutdown()
    assert.isFalse(provider.isScheduled())
  })

  test('shutdown() is a no-op when nothing was ever scheduled', async ({ assert }) => {
    const provider = new BackupSchedulerProvider(fakeApp('test'))
    await provider.shutdown()
    assert.isFalse(provider.isScheduled())
  })
})
