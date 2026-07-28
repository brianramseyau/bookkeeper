import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from './notification-preferences'

vi.mock('$lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

describe('notification preferences api', () => {
  it('gets the current user notification preferences', () => {
    getNotificationPreferences()
    expect(api.get).toHaveBeenCalledWith('/notification-preferences')
  })

  it('updates the current user notification preferences', () => {
    const payload = {
      enabled: true,
      leadDays: 5,
      notifyUtilityBills: true,
      notifyRecurringBills: false,
      notifySubscriptions: true,
    }
    updateNotificationPreferences(payload)
    expect(api.put).toHaveBeenCalledWith('/notification-preferences', payload)
  })
})
