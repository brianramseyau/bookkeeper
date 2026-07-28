import { test } from '@japa/runner'
import type { AppEnvironments } from '@adonisjs/core/types/app'
import IntervalTaskProvider from '#providers/interval_task_provider'

function fakeApp(environment: AppEnvironments) {
  return { getEnvironment: () => environment } as never
}

class TestIntervalTaskProvider extends IntervalTaskProvider {
  runCount = 0

  async runTask(): Promise<void> {
    this.runCount++
  }
}

test.group('IntervalTaskProvider', () => {
  test('tick() runs the task directly', async ({ assert }) => {
    const provider = new TestIntervalTaskProvider(fakeApp('test'), 1000)
    await provider.tick()
    assert.equal(provider.runCount, 1)
  })

  test('ready() does not schedule anything outside the "web" environment', async ({ assert }) => {
    const provider = new TestIntervalTaskProvider(fakeApp('test'), 1000)

    await provider.ready()

    assert.isFalse(provider.isScheduled())
    await provider.shutdown()
  })

  test('ready() schedules the periodic check when running as the server', async ({ assert }) => {
    const provider = new TestIntervalTaskProvider(fakeApp('web'), 1000)

    await provider.ready()

    assert.isTrue(provider.isScheduled())
    await provider.shutdown()
    assert.isFalse(provider.isScheduled())
  })

  test('shutdown() is a no-op when nothing was ever scheduled', async ({ assert }) => {
    const provider = new TestIntervalTaskProvider(fakeApp('test'), 1000)
    await provider.shutdown()
    assert.isFalse(provider.isScheduled())
  })
})
