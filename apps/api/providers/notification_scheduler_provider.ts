import type { ApplicationService } from '@adonisjs/core/types'
import IntervalTaskProvider from '#providers/interval_task_provider'

/** How often to check whether the daily notification check is due - see `#services/notification_scheduler` for the actual once-a-day-at-`sendHour` decision. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

export default class NotificationSchedulerProvider extends IntervalTaskProvider {
  constructor(app: ApplicationService) {
    super(app, CHECK_INTERVAL_MS)
  }

  async runTask(): Promise<void> {
    // Imported lazily (rather than at module top-level) so this provider's
    // eager construction during app boot doesn't pull in the whole model
    // graph - `notification_scheduler` transitively imports `UserSubscription`,
    // which imports the `User` model, which resolves the Hash service at
    // import time. Doing that too early in the provider boot sequence (before
    // HashProvider finishes booting) breaks password hashing for the rest of
    // that boot cycle - see the seeder failure this caused before this got
    // deferred.
    const { runDueNotificationCheck } = await import('#services/notification_scheduler')
    await runDueNotificationCheck()
  }
}
