import fs from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import { DateTime } from 'luxon'
import config from '@adonisjs/core/services/config'

export type BackupSource = 'automatic' | 'manual'

export interface BackupFileInfo {
  filename: string
  sizeBytes: number
  createdAt: DateTime
  source: BackupSource
}

const FILENAME_PREFIX = 'bookkeeper-backup-'

/**
 * The `(auto|manual)-` tag is optional in the pattern so backups written
 * before this distinction existed (already on disk in production) still
 * match - see `sourceFromFilename`, which treats an untagged name as
 * `automatic` since that's what every backup was before "Backup now" got
 * its own tag.
 */
const FILENAME_PATTERN = /^bookkeeper-backup-(?:(auto|manual)-)?(\d{8}-\d{6})\.sqlite3$/

/**
 * Directory backups are written to - a `backups` sibling of the live SQLite
 * file, so in Docker that's `/app/data/backups` (DB_FILENAME is
 * `/app/data/bookkeeper.sqlite3`) with no separate config needed.
 */
export function backupDir(): string {
  const dbFilename = config.get<string>('database.connections.sqlite.connection.filename')
  return path.join(path.dirname(dbFilename), 'backups')
}

function backupPath(filename: string): string {
  return path.join(backupDir(), filename)
}

/**
 * True if `filename` matches the naming scheme this service generates
 * itself - used to guard delete/download endpoints against path traversal
 * or being pointed at arbitrary files.
 */
export function isBackupFilename(filename: string): boolean {
  return FILENAME_PATTERN.test(filename)
}

/** Callers must have already confirmed `filename` matches `isBackupFilename`. */
function sourceFromFilename(filename: string): BackupSource {
  const match = FILENAME_PATTERN.exec(filename)!
  return match[1] === 'manual' ? 'manual' : 'automatic'
}

const TIMESTAMP_FORMAT = 'yyyyLLdd-HHmmss'

function timestampedFilename(now: DateTime, source: BackupSource): string {
  const tag = source === 'manual' ? 'manual' : 'auto'
  return `${FILENAME_PREFIX}${tag}-${now.toFormat(TIMESTAMP_FORMAT)}.sqlite3`
}

/**
 * The timestamp encoded in a backup's own filename - used instead of the
 * file's filesystem mtime, which a copy/restore/sync could easily change
 * to "now", and which the backup schedule (`#services/backup_scheduler`)
 * needs to stay tied to when the backup actually ran.
 */
function timestampFromFilename(filename: string): DateTime {
  const match = FILENAME_PATTERN.exec(filename)!
  return DateTime.fromFormat(match[2]!, TIMESTAMP_FORMAT, { zone: 'utc' })
}

/**
 * Snapshots the live database into a new file under `backupDir()` using
 * SQLite's own online backup API (same guarantee as the `.backup` command
 * documented in the README) via a fresh, independent connection - reading
 * a consistent snapshot even while the app's own connection is mid-write,
 * without going anywhere near whatever transaction that connection may
 * currently be in.
 */
export async function createBackup(
  now: DateTime = DateTime.utc(),
  source: BackupSource = 'automatic'
): Promise<BackupFileInfo> {
  const dir = backupDir()
  await fs.mkdir(dir, { recursive: true })

  const filename = timestampedFilename(now, source)
  const destination = backupPath(filename)
  const dbFilename = config.get<string>('database.connections.sqlite.connection.filename')

  const db = new Database(dbFilename, { readonly: true })
  try {
    await db.backup(destination)
  } finally {
    db.close()
  }

  const stat = await fs.stat(destination)
  return { filename, sizeBytes: stat.size, createdAt: now, source }
}

/** Existing backups, newest first. Returns an empty list if the directory doesn't exist yet. */
export async function listBackups(): Promise<BackupFileInfo[]> {
  const dir = backupDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const backups = await Promise.all(
    entries
      .filter((name) => isBackupFilename(name))
      .map(async (filename) => {
        const stat = await fs.stat(backupPath(filename))
        return {
          filename,
          sizeBytes: stat.size,
          createdAt: timestampFromFilename(filename),
          source: sourceFromFilename(filename),
        }
      })
  )

  return backups.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
}

/** Deletes a single backup by filename. Returns false (rather than throwing) if it doesn't exist or the name isn't a backup file. */
export async function deleteBackup(filename: string): Promise<boolean> {
  if (!isBackupFilename(filename)) return false

  try {
    await fs.unlink(backupPath(filename))
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** Absolute path to a backup file, or null if `filename` isn't a valid backup name (see `isBackupFilename`). For serving downloads. */
export function resolveBackupPath(filename: string): string | null {
  return isBackupFilename(filename) ? backupPath(filename) : null
}

/**
 * Keeps only the newest `retentionCount` automatic backups, deleting the
 * rest. Manual backups are exempt from retention entirely - someone who
 * clicks "Backup now" is making a deliberate snapshot, not participating in
 * the rolling schedule, so it stays until explicitly deleted. Pruning by
 * count rather than by age also means retention needs nothing but the
 * backup files themselves - no separately-tracked "last run" state that
 * could drift out of sync with what's actually on disk (see
 * `#services/backup_scheduler`).
 */
export async function pruneAutomaticBackups(retentionCount: number): Promise<number> {
  const allBackups = await listBackups()
  const automatic = allBackups.filter((backup) => backup.source === 'automatic')
  const excess = automatic.slice(retentionCount)
  await Promise.all(excess.map((backup) => deleteBackup(backup.filename)))
  return excess.length
}
