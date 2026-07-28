import type { ApplicationService } from '@adonisjs/core/types'
import IntervalTaskProvider from '#providers/interval_task_provider'
import { runDueBackupCheck } from '#services/backup_scheduler'

/** How often to check whether a scheduled backup is due - not the backup interval itself (see `#services/backup_scheduler`), just the polling cadence for that check. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

export default class BackupSchedulerProvider extends IntervalTaskProvider {
  constructor(app: ApplicationService) {
    super(app, CHECK_INTERVAL_MS)
  }

  async runTask(): Promise<void> {
    await runDueBackupCheck()
  }
}
