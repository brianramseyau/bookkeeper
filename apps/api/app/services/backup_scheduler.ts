import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import BackupSetting from '#models/backup_setting'
import { createBackup, purgeExpired } from '#services/backup_service'

/** The one settings row this app has - there's no per-user dimension to a backup schedule. */
const SETTINGS_ID = 1

/** Defaults mirror the migration's own column defaults - set explicitly here too so a freshly-created row's in-memory attributes are real JS values right away, not whatever SQLite's raw 0/1 comes back as before a re-fetch. */
const DEFAULT_SETTINGS = { enabled: true, intervalHours: 24, retentionDays: 7, lastRunAt: null }

export async function getBackupSettings(): Promise<BackupSetting> {
  return BackupSetting.firstOrCreate({ id: SETTINGS_ID }, DEFAULT_SETTINGS)
}

/**
 * True when the schedule is on and enough time has elapsed since the last
 * run (or none has ever run) for another to be due.
 */
export function isBackupDue(
  settings: Pick<BackupSetting, 'enabled' | 'intervalHours' | 'lastRunAt'>,
  now: DateTime
): boolean {
  if (!settings.enabled) return false
  if (!settings.lastRunAt) return true
  return now.diff(settings.lastRunAt, 'hours').hours >= settings.intervalHours
}

/**
 * Runs a backup (and purges expired ones) if the schedule says it's due.
 * Swallows and logs its own errors so a failed backup never crashes the
 * periodic scheduler loop that calls this.
 */
export async function runDueBackupCheck(now: DateTime = DateTime.utc()): Promise<void> {
  const settings = await getBackupSettings()
  if (!isBackupDue(settings, now)) return

  try {
    await createBackup(now)
    await purgeExpired(settings.retentionDays, now)
    settings.lastRunAt = now
    await settings.save()
  } catch (error) {
    logger.error({ err: error }, 'Scheduled backup failed')
  }
}
