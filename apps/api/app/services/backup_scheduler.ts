import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import BackupSetting from '#models/backup_setting'
import { createBackup, purgeExpired } from '#services/backup_service'

/** The one settings row this app has - there's no per-user dimension to a backup schedule. */
const SETTINGS_ID = 1

/** Defaults mirror the migration's own column defaults - set explicitly here too so a freshly-created row's in-memory attributes are real JS values right away, not whatever SQLite's raw 0/1 comes back as before a re-fetch. */
const DEFAULT_SETTINGS = {
  enabled: true,
  intervalHours: 24,
  retentionDays: 7,
  runHour: 1,
  lastRunAt: null,
}

export async function getBackupSettings(): Promise<BackupSetting> {
  return BackupSetting.firstOrCreate({ id: SETTINGS_ID }, DEFAULT_SETTINGS)
}

/**
 * A fixed local-time reference instant, used only as the zero point for the
 * `intervalHours` slot arithmetic below - never compared against directly.
 */
const SCHEDULE_EPOCH = { year: 2000, month: 1, day: 1 }

/**
 * Start of the most recent scheduled slot at or before `now`: every
 * `intervalHours` hours, anchored to `runHour` on `SCHEDULE_EPOCH`'s date so
 * slots land on a fixed clock time (e.g. 1am daily, or 1am/1pm for a
 * 12-hour interval) instead of drifting - unlike measuring elapsed time
 * since whenever the last run happened to fire, which walks around the
 * clock over many runs as each one's timestamp shifts by up to however late
 * the poll loop was.
 */
function currentSlotStart(runHour: number, intervalHours: number, now: DateTime): DateTime {
  const anchor = DateTime.local(
    SCHEDULE_EPOCH.year,
    SCHEDULE_EPOCH.month,
    SCHEDULE_EPOCH.day,
    runHour
  )
  const hoursSinceAnchor = now.diff(anchor, 'hours').hours
  const slotIndex = Math.floor(hoursSinceAnchor / intervalHours)
  return anchor.plus({ hours: slotIndex * intervalHours })
}

/**
 * True when the schedule is on and `now` has reached (or passed) the start
 * of a scheduled slot that hasn't run yet.
 */
export function isBackupDue(
  settings: Pick<BackupSetting, 'enabled' | 'intervalHours' | 'runHour' | 'lastRunAt'>,
  now: DateTime
): boolean {
  if (!settings.enabled) return false
  if (!settings.lastRunAt) return true
  const slotStart = currentSlotStart(settings.runHour, settings.intervalHours, now)
  return settings.lastRunAt < slotStart
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
