import { api } from '$lib/api'

export interface BackupSettings {
  id: number
  enabled: boolean
  intervalHours: number
  retentionDays: number
  lastRunAt: string | null
  createdAt: string
  updatedAt: string | null
}

export function getBackupSettings() {
  return api.get<BackupSettings>('/backup-settings')
}

export interface UpdateBackupSettingsPayload {
  enabled: boolean
  intervalHours: number
  retentionDays: number
}

export function updateBackupSettings(payload: UpdateBackupSettingsPayload) {
  return api.put<BackupSettings>('/backup-settings', payload)
}
