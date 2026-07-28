import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { getNotificationSchedule, updateNotificationSchedule } from './notification-schedule'

vi.mock('$lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

describe('notification schedule api', () => {
  it('gets the notification schedule', () => {
    getNotificationSchedule()
    expect(api.get).toHaveBeenCalledWith('/notification-schedule')
  })

  it('updates the notification schedule', () => {
    updateNotificationSchedule({ sendHour: 20 })
    expect(api.put).toHaveBeenCalledWith('/notification-schedule', { sendHour: 20 })
  })
})
