import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Backup } from '$lib/api/backups'
import BackupList from './BackupList.svelte'

const backupA: Backup = {
  filename: 'bookkeeper-backup-auto-20260127-030000.sqlite3',
  sizeBytes: 2048,
  createdAt: '2026-01-27T03:00:00.000+00:00',
  source: 'automatic',
}

describe('BackupList', () => {
  it('renders the backup date, size and download link', () => {
    render(BackupList, { backups: [backupA], deletingFilename: null, onDelete: vi.fn() })

    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/backups/bookkeeper-backup-auto-20260127-030000.sqlite3/download'
    )
  })

  it('reports deletes', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(BackupList, { backups: [backupA], deletingFilename: null, onDelete })

    await user.click(screen.getByRole('button', { name: /^Delete backup from/ }))
    expect(onDelete).toHaveBeenCalledWith(backupA)
  })
})
