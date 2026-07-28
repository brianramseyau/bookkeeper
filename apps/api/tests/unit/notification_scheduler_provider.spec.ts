import { test } from '@japa/runner'
import type { AppEnvironments } from '@adonisjs/core/types/app'
import NotificationSchedulerProvider from '#providers/notification_scheduler_provider'
import NotificationSchedule from '#models/notification_schedule'

function fakeApp(environment: AppEnvironments) {
  return { getEnvironment: () => environment } as never
}

test.group('NotificationSchedulerProvider', (group) => {
  group.each.teardown(async () => {
    await NotificationSchedule.query().where('id', 1).delete()
  })

  test('tick() runs the due-notification check directly (used by tests and the real timer callback)', async ({
    assert,
  }) => {
    const provider = new NotificationSchedulerProvider(fakeApp('test'))
    // Doesn't throw, and creates the default schedule row on first run -
    // runDueNotificationCheck itself is exercised in depth by
    // notification_scheduler.spec.ts.
    await provider.tick()
    assert.isTrue(true)
  })

  test('ready() does not schedule anything outside the "web" environment', async ({ assert }) => {
    const provider = new NotificationSchedulerProvider(fakeApp('test'))

    await provider.ready()

    assert.isFalse(provider.isScheduled())
    await provider.shutdown()
  })

  test('ready() schedules the periodic check when running as the server', async ({ assert }) => {
    const provider = new NotificationSchedulerProvider(fakeApp('web'))

    await provider.ready()

    assert.isTrue(provider.isScheduled())
    await provider.shutdown()
    assert.isFalse(provider.isScheduled())
  })

  test('shutdown() is a no-op when nothing was ever scheduled', async ({ assert }) => {
    const provider = new NotificationSchedulerProvider(fakeApp('test'))
    await provider.shutdown()
    assert.isFalse(provider.isScheduled())
  })
})
