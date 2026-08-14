import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { getBackupSettings, updateBackupSettings } from './backup-settings'

vi.mock('$lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

describe('backup settings api', () => {
  it('gets the backup schedule', () => {
    getBackupSettings()
    expect(api.get).toHaveBeenCalledWith('/backup-settings')
  })

  it('updates the backup schedule', () => {
    updateBackupSettings({ enabled: true, intervalHours: 24, retentionDays: 7, runHour: 1 })
    expect(api.put).toHaveBeenCalledWith('/backup-settings', {
      enabled: true,
      intervalHours: 24,
      retentionDays: 7,
      runHour: 1,
    })
  })
})
