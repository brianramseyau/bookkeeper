import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { backupDownloadUrl, createBackup, deleteBackup, listBackups } from './backups'

vi.mock('$lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

describe('backups api', () => {
  it('lists backups', () => {
    listBackups()
    expect(api.get).toHaveBeenCalledWith('/backups')
  })

  it('creates a backup', () => {
    createBackup()
    expect(api.post).toHaveBeenCalledWith('/backups')
  })

  it('deletes a backup by filename', () => {
    deleteBackup('bookkeeper-backup-20260728-030000.sqlite3')
    expect(api.delete).toHaveBeenCalledWith('/backups/bookkeeper-backup-20260728-030000.sqlite3')
  })

  it('url-encodes the filename when deleting', () => {
    deleteBackup('weird name.sqlite3')
    expect(api.delete).toHaveBeenCalledWith('/backups/weird%20name.sqlite3')
  })

  it('builds a download url for a filename', () => {
    expect(backupDownloadUrl('bookkeeper-backup-20260728-030000.sqlite3')).toEqual(
      '/api/backups/bookkeeper-backup-20260728-030000.sqlite3/download'
    )
  })
})
