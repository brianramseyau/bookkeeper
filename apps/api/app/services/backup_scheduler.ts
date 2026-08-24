import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import BackupSetting, { type BackupFrequency } from '#models/backup_setting'
import { createBackup, listBackups, pruneAutomaticBackups } from '#services/backup_service'

/** The one settings row this app has - there's no per-user dimension to a backup schedule. */
const SETTINGS_ID = 1

/** Defaults mirror the migration's own column defaults - set explicitly here too so a freshly-created row's in-memory attributes are real JS values right away, not whatever SQLite's raw 0/1 comes back as before a re-fetch. */
const DEFAULT_SETTINGS = {
  enabled: true,
  frequency: 'daily' as BackupFrequency,
  timeOfDay: '01:00',
  retentionCount: 7,
}

export async function getBackupSettings(): Promise<BackupSetting> {
  return BackupSetting.firstOrCreate({ id: SETTINGS_ID }, DEFAULT_SETTINGS)
}

/**
 * Start of the current scheduling period as of `now` - e.g. for a daily
 * 1am schedule checked at 1:04am, this is today at 1:00am; checked at
 * 12:30am it's yesterday's 1:00am. Weekly anchors to Sunday, monthly to
 * the 1st.
 */
export function currentPeriodStart(
  frequency: BackupFrequency,
  timeOfDay: string,
  now: DateTime
): DateTime {
  const [hour, minute] = timeOfDay.split(':').map(Number)

  if (frequency === 'daily') {
    const candidate = now.set({ hour, minute, second: 0, millisecond: 0 })
    return candidate > now ? candidate.minus({ days: 1 }) : candidate
  }

  if (frequency === 'weekly') {
    // Luxon weekday: 1 = Monday ... 7 = Sunday. Anchored on Sunday.
    const today = now.set({ hour, minute, second: 0, millisecond: 0 })
    const daysSinceSunday = today.weekday % 7
    const candidate = today.minus({ days: daysSinceSunday })
    return candidate > now ? candidate.minus({ weeks: 1 }) : candidate
  }

  const candidate = now.set({ day: 1, hour, minute, second: 0, millisecond: 0 })
  return candidate > now ? candidate.minus({ months: 1 }) : candidate
}

/**
 * The most recent automatic backup's timestamp, or null if none exist yet -
 * read straight off disk (via the backup filenames `listBackups` already
 * parses) rather than tracked in a separate DB column, so it can never
 * drift out of sync with what's actually there. This is what the old
 * schedule got wrong: it stamped a `lastRunAt` column on every run and
 * compared it against an hours-since-a-fixed-epoch "slot" calculation,
 * which in production disagreed with itself across restarts/polls and fired
 * a backup on every 15-minute poll instead of once a day.
 */
async function lastAutomaticBackupAt(): Promise<DateTime | null> {
  const allBackups = await listBackups()
  const automatic = allBackups.filter((backup) => backup.source === 'automatic')
  return automatic[0]?.createdAt ?? null
}

/**
 * Due at most once per period: fires as soon as `now` reaches the period's
 * scheduled time, and stays "not due" once the last automatic backup
 * catches up to it. If no automatic backup has ever run, waits for the
 * first period boundary *after* the schedule was created rather than
 * backdating to whatever the current period's start happens to be -
 * otherwise a freshly-created schedule (e.g. this instance's first-ever
 * startup) would see a stale, already-elapsed period as "due" and fire
 * immediately, however far that is from the configured time of day.
 */
export function isBackupDue(
  settings: { enabled: boolean; frequency: BackupFrequency; timeOfDay: string },
  lastAutomaticAt: DateTime | null,
  now: DateTime,
  scheduleCreatedAt: DateTime | null = null
): boolean {
  if (!settings.enabled) return false

  const periodStart = currentPeriodStart(settings.frequency, settings.timeOfDay, now)
  if (lastAutomaticAt) return lastAutomaticAt < periodStart
  return !scheduleCreatedAt || periodStart >= scheduleCreatedAt
}

/**
 * Runs a backup (and prunes down to the retention count) if the schedule
 * says it's due. Swallows and logs its own errors so a failed backup never
 * crashes the periodic scheduler loop that calls this.
 */
export async function runDueBackupCheck(now: DateTime = DateTime.local()): Promise<void> {
  const settings = await getBackupSettings()

  // Everything below - including `lastAutomaticBackupAt`'s own disk read -
  // goes through this one try/catch, not just the backup/prune calls: a
  // read failure there is just as much "the scheduled check couldn't
  // complete" as a failed backup, and must never crash the periodic loop
  // that calls this either.
  try {
    const due = isBackupDue(
      {
        enabled: settings.enabled,
        frequency: settings.frequency as BackupFrequency,
        timeOfDay: settings.timeOfDay,
      },
      await lastAutomaticBackupAt(),
      now,
      settings.createdAt
    )
    if (!due) return

    // `now` is deliberately local (see the default param above) so "Time of
    // day" is interpreted in the container's TZ, matching the notification
    // schedule (#services/notification_scheduler) - but the backup's own
    // stored timestamp/filename must stay a plain UTC instant, since
    // `timestampFromFilename` (#services/backup_service) parses it back as
    // UTC regardless of what zone produced it.
    await createBackup(now.toUTC())
    await pruneAutomaticBackups(settings.retentionCount)
  } catch (error) {
    logger.error({ err: error }, 'Scheduled backup failed')
  }
}
