import type { ApplicationService } from '@adonisjs/core/types'
import { runDueBackupCheck } from '#services/backup_scheduler'

/** How often to check whether a scheduled backup is due - not the backup interval itself (see `#services/backup_scheduler`), just the polling cadence for that check. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Runs the automatic backup schedule in the background for the lifetime of
 * the server process - the same single Node process that serves HTTP
 * requests, since this app has no separate worker/cron process. Only starts
 * when actually running as the server (`app.getEnvironment() === 'web'`),
 * not for one-off ace commands or the test runner.
 */
export default class BackupSchedulerProvider {
  #timer?: NodeJS.Timeout

  constructor(protected app: ApplicationService) {}

  /** Checks whether a scheduled backup is due right now and runs it if so. Public (rather than folded into `ready()`) so it can be invoked directly in tests without waiting on a real timer. */
  async tick(): Promise<void> {
    await runDueBackupCheck()
  }

  async ready() {
    if (this.app.getEnvironment() !== 'web') return
    this.#timer = setInterval(this.tick.bind(this), CHECK_INTERVAL_MS)
    this.#timer.unref()
  }

  /** True once the background poll has been scheduled - exposed for tests. */
  isScheduled(): boolean {
    return this.#timer !== undefined
  }

  async shutdown() {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = undefined
  }
}
