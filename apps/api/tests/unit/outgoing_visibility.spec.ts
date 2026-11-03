import { test } from '@japa/runner'
import {
  isOutgoingVisibleForMonth,
  type OutgoingLifecycleFlags,
} from '#services/outgoing_visibility'

function flags(overrides: Partial<OutgoingLifecycleFlags> = {}): OutgoingLifecycleFlags {
  return { isActive: true, isPaused: false, isArchived: false, ...overrides }
}

test.group('isOutgoingVisibleForMonth', () => {
  test('an active item is visible whether or not this month was paid', ({ assert }) => {
    assert.isTrue(isOutgoingVisibleForMonth(flags(), false))
    assert.isTrue(isOutgoingVisibleForMonth(flags(), true))
  })

  test('a paused or archived item is hidden unless this month was actually paid', ({ assert }) => {
    assert.isFalse(isOutgoingVisibleForMonth(flags({ isPaused: true }), false))
    assert.isTrue(isOutgoingVisibleForMonth(flags({ isPaused: true }), true))
    assert.isFalse(isOutgoingVisibleForMonth(flags({ isArchived: true }), false))
    assert.isTrue(isOutgoingVisibleForMonth(flags({ isArchived: true }), true))
  })

  test('a removed (inactive) item stays hidden even if a payment row exists', ({ assert }) => {
    assert.isFalse(isOutgoingVisibleForMonth(flags({ isActive: false }), false))
    assert.isFalse(isOutgoingVisibleForMonth(flags({ isActive: false }), true))
    assert.isFalse(isOutgoingVisibleForMonth(flags({ isActive: false, isPaused: true }), true))
    assert.isFalse(isOutgoingVisibleForMonth(flags({ isActive: false, isArchived: true }), true))
  })
})
