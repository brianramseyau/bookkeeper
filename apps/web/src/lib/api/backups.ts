import { api } from '$lib/api'

export interface Backup {
  filename: string
  sizeBytes: number
  createdAt: string
  source: 'automatic' | 'manual'
}

export function listBackups() {
  return api.get<Backup[]>('/backups')
}

export function createBackup() {
  return api.post<Backup>('/backups')
}

export function deleteBackup(filename: string) {
  return api.delete<void>(`/backups/${encodeURIComponent(filename)}`)
}

export function backupDownloadUrl(filename: string) {
  return `/api/backups/${encodeURIComponent(filename)}/download`
}
