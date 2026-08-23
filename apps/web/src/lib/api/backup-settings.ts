import { api } from '$lib/api'

export type BackupFrequency = 'daily' | 'weekly' | 'monthly'

export interface BackupSettings {
  id: number
  enabled: boolean
  frequency: BackupFrequency
  timeOfDay: string
  retentionCount: number
  createdAt: string
  updatedAt: string | null
}

export function getBackupSettings() {
  return api.get<BackupSettings>('/backup-settings')
}

export interface UpdateBackupSettingsPayload {
  enabled: boolean
  frequency: BackupFrequency
  timeOfDay: string
  retentionCount: number
}

export function updateBackupSettings(payload: UpdateBackupSettingsPayload) {
  return api.put<BackupSettings>('/backup-settings', payload)
}
