import fs from 'node:fs/promises'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  backupDir,
  createBackup,
  deleteBackup,
  isBackupFilename,
  listBackups,
  purgeExpired,
  resolveBackupPath,
} from '#services/backup_service'

test.group('BackupService', (group) => {
  group.each.teardown(async () => {
    await fs.rm(backupDir(), { recursive: true, force: true })
  })

  test('isBackupFilename accepts only names this service could have generated', ({ assert }) => {
    assert.isTrue(isBackupFilename('bookkeeper-backup-20260728-030000.sqlite3'))
    assert.isFalse(isBackupFilename('../../etc/passwd'))
    assert.isFalse(isBackupFilename('bookkeeper.sqlite3'))
    assert.isFalse(isBackupFilename('bookkeeper-backup-20260728-030000.sqlite3.bak'))
  })

  test('createBackup writes a real, readable sqlite file under backupDir()', async ({ assert }) => {
    const now = DateTime.utc(2026, 7, 28, 3, 0, 0)

    const backup = await createBackup(now)

    assert.equal(backup.filename, 'bookkeeper-backup-20260728-030000.sqlite3')
    assert.isAbove(backup.sizeBytes, 0)
    const stat = await fs.stat(resolveBackupPath(backup.filename)!)
    assert.isTrue(stat.isFile())
  })

  test('listBackups returns an empty array when the directory does not exist yet', async ({
    assert,
  }) => {
    const backups = await listBackups()
    assert.deepEqual(backups, [])
  })

  test('listBackups returns created backups newest first', async ({ assert }) => {
    await createBackup(DateTime.utc(2026, 7, 26, 3, 0, 0))
    await createBackup(DateTime.utc(2026, 7, 28, 3, 0, 0))

    const backups = await listBackups()

    assert.lengthOf(backups, 2)
    assert.equal(backups[0]!.filename, 'bookkeeper-backup-20260728-030000.sqlite3')
    assert.equal(backups[1]!.filename, 'bookkeeper-backup-20260726-030000.sqlite3')
  })

  test('listBackups ignores files that are not backups', async ({ assert }) => {
    await fs.mkdir(backupDir(), { recursive: true })
    await fs.writeFile(`${backupDir()}/not-a-backup.txt`, 'hello')

    const backups = await listBackups()

    assert.deepEqual(backups, [])
  })

  test('deleteBackup removes an existing backup and returns true', async ({ assert }) => {
    const backup = await createBackup(DateTime.utc(2026, 7, 28, 3, 0, 0))

    const deleted = await deleteBackup(backup.filename)

    assert.isTrue(deleted)
    assert.deepEqual(await listBackups(), [])
  })

  test('deleteBackup returns false for a filename that does not exist', async ({ assert }) => {
    const deleted = await deleteBackup('bookkeeper-backup-20260101-000000.sqlite3')
    assert.isFalse(deleted)
  })

  test('deleteBackup returns false rather than deleting an unsafe filename', async ({ assert }) => {
    const deleted = await deleteBackup('../../etc/passwd')
    assert.isFalse(deleted)
  })

  test('deleteBackup re-throws errors other than "not found"', async ({ assert }) => {
    // A directory (rather than a file) at a would-be backup path fails
    // unlink with EISDIR/EPERM, not ENOENT - the simplest portable way to
    // exercise the "unexpected error" branch without a mocking library.
    const filename = 'bookkeeper-backup-20260101-000000.sqlite3'
    await fs.mkdir(`${backupDir()}/${filename}`, { recursive: true })

    await assert.rejects(() => deleteBackup(filename))
  })

  test('listBackups re-throws errors other than "directory not found"', async ({ assert }) => {
    // A plain file (rather than a directory) at backupDir() fails readdir
    // with ENOTDIR, not ENOENT - backupDir()'s parent (the app's own tmp
    // dir) already exists, so no need to create it first.
    await fs.writeFile(backupDir(), 'not a directory')

    await assert.rejects(() => listBackups())
  })

  test('resolveBackupPath returns null for an unsafe filename', ({ assert }) => {
    assert.isNull(resolveBackupPath('../../etc/passwd'))
  })

  test('purgeExpired deletes only backups older than retentionDays', async ({ assert }) => {
    const now = DateTime.utc(2026, 7, 28, 12, 0, 0)
    await createBackup(now.minus({ days: 10 }))
    await createBackup(now.minus({ days: 1 }))

    const removed = await purgeExpired(7, now)

    assert.equal(removed, 1)
    const remaining = await listBackups()
    assert.lengthOf(remaining, 1)
    assert.isTrue(remaining[0]!.createdAt >= now.minus({ days: 7 }))
  })
})
