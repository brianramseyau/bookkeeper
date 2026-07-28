import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Generic base for a provider that runs some task on a repeating interval in
 * the background for the lifetime of the server process - the same single
 * Node process that serves HTTP requests, since this app has no separate
 * worker/cron process. Only starts when actually running as the server
 * (`app.getEnvironment() === 'web'`), not for one-off ace commands or the
 * test runner. Subclasses (e.g. the backup and notification schedulers) just
 * supply an interval and a `runTask()` implementation.
 */
export default abstract class IntervalTaskProvider {
  #timer?: NodeJS.Timeout

  constructor(
    protected app: ApplicationService,
    protected intervalMs: number
  ) {}

  /** What to do on each tick - implemented by subclasses. */
  abstract runTask(): Promise<void>

  /** Runs the task directly, used by the real timer callback and by tests without waiting on one. */
  async tick(): Promise<void> {
    await this.runTask()
  }

  async ready() {
    if (this.app.getEnvironment() !== 'web') return
    this.#timer = setInterval(this.tick.bind(this), this.intervalMs)
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
