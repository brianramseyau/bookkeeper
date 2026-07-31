import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBackupSettings,
  updateBackupSettings,
  type BackupSettings,
} from '$lib/api/backup-settings'
import { createBackup, deleteBackup, listBackups, type Backup } from '$lib/api/backups'
import {
  getNotificationSchedule,
  updateNotificationSchedule,
  type NotificationSchedule,
} from '$lib/api/notification-schedule'
import { ApiError } from '$lib/api'
import { formatDateTime } from '$lib/format'
import TasksPage from './+page.svelte'

vi.mock('$lib/api/backup-settings', () => ({
  getBackupSettings: vi.fn(),
  updateBackupSettings: vi.fn(),
}))
vi.mock('$lib/api/backups', () => ({
  listBackups: vi.fn(),
  createBackup: vi.fn(),
  deleteBackup: vi.fn(),
  backupDownloadUrl: (filename: string) => `/api/backups/${filename}/download`,
}))
vi.mock('$lib/api/notification-schedule', () => ({
  getNotificationSchedule: vi.fn(),
  updateNotificationSchedule: vi.fn(),
}))

const defaultSettings: BackupSettings = {
  id: 1,
  enabled: false,
  intervalHours: 24,
  retentionDays: 7,
  lastRunAt: null,
  createdAt: '2026-01-01T00:00:00.000+00:00',
  updatedAt: null,
}

const backupA: Backup = {
  filename: 'bookkeeper-backup-20260127-030000.sqlite3',
  sizeBytes: 2048,
  createdAt: '2026-01-27T03:00:00.000+00:00',
}

const defaultNotificationSchedule: NotificationSchedule = {
  id: 1,
  sendHour: 8,
  lastRunAt: null,
  createdAt: '2026-01-01T00:00:00.000+00:00',
  updatedAt: null,
}

describe('tasks page', () => {
  beforeEach(() => {
    vi.mocked(getBackupSettings).mockReset()
    vi.mocked(updateBackupSettings).mockReset()
    vi.mocked(listBackups).mockReset()
    vi.mocked(createBackup).mockReset()
    vi.mocked(deleteBackup).mockReset()
    vi.mocked(getNotificationSchedule).mockReset().mockResolvedValue(defaultNotificationSchedule)
    vi.mocked(updateNotificationSchedule).mockReset()
  })

  it('loads and shows the backup schedule and existing backups', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue({
      ...defaultSettings,
      enabled: true,
      intervalHours: 12,
      retentionDays: 14,
      lastRunAt: '2026-01-27T03:00:00.000+00:00',
    })
    vi.mocked(listBackups).mockResolvedValue([backupA])

    render(TasksPage)

    expect(await screen.findByText(/Last backup:/)).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox', { name: 'Enabled' }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    const downloadLink = screen.getByRole('link', { name: 'Download' })
    expect(downloadLink.getAttribute('href')).toBe(
      '/api/backups/bookkeeper-backup-20260127-030000.sqlite3/download'
    )
  })

  it('shows an error when the schedule fails to load', async () => {
    vi.mocked(getBackupSettings).mockRejectedValue(new ApiError(500, 'Could not load schedule'))
    vi.mocked(listBackups).mockResolvedValue([])

    render(TasksPage)

    expect(await screen.findByText('Could not load schedule')).toBeInTheDocument()
  })

  it('shows an error when backups fail to load', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockRejectedValue(new Error('boom'))

    render(TasksPage)

    expect(await screen.findByText('Failed to load backups')).toBeInTheDocument()
  })

  it('shows a placeholder when there are no backups yet', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])

    render(TasksPage)

    expect(await screen.findByText('No backups yet')).toBeInTheDocument()
  })

  it('saves the backup schedule', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(updateBackupSettings).mockResolvedValue({
      ...defaultSettings,
      enabled: true,
      intervalHours: 48,
      retentionDays: 30,
    })
    const user = userEvent.setup()
    render(TasksPage)

    await user.click(await screen.findByRole('checkbox', { name: 'Enabled' }))
    await user.selectOptions(screen.getByLabelText('Frequency'), '48')
    await user.clear(screen.getByLabelText('Keep for (days)'))
    await user.type(screen.getByLabelText('Keep for (days)'), '30')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(updateBackupSettings).toHaveBeenCalledWith({
      enabled: true,
      intervalHours: 48,
      retentionDays: 30,
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows an error when saving the schedule fails', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(updateBackupSettings).mockRejectedValue(new ApiError(422, 'Invalid schedule'))
    const user = userEvent.setup()
    render(TasksPage)

    await user.click((await screen.findAllByRole('button', { name: 'Save' }))[0]!)

    expect(await screen.findByText('Invalid schedule')).toBeInTheDocument()
  })

  it('creates a backup on demand and refreshes the list and schedule', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(createBackup).mockResolvedValue(backupA)
    const user = userEvent.setup()
    render(TasksPage)

    await screen.findByText('No backups yet')
    vi.mocked(listBackups).mockResolvedValue([backupA])
    vi.mocked(getBackupSettings).mockResolvedValue({
      ...defaultSettings,
      lastRunAt: '2026-01-27T03:00:00.000+00:00',
    })

    await user.click(screen.getByRole('button', { name: 'Backup now' }))

    expect(createBackup).toHaveBeenCalled()
    expect(await screen.findByText('2.0 KB')).toBeInTheDocument()
  })

  it('shows an error when creating a backup fails', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(createBackup).mockRejectedValue(new ApiError(500, 'Backup failed'))
    const user = userEvent.setup()
    render(TasksPage)

    await user.click(await screen.findByRole('button', { name: 'Backup now' }))

    expect(await screen.findByText('Backup failed')).toBeInTheDocument()
  })

  it('deletes a backup after confirming', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([backupA])
    vi.mocked(deleteBackup).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(TasksPage)

    await user.click(
      await screen.findByRole('button', {
        name: `Delete backup from ${formatDateTime(backupA.createdAt)}`,
      })
    )

    expect(window.confirm).toHaveBeenCalledWith(
      `Permanently delete "${backupA.filename}"? This cannot be undone.`
    )
    expect(deleteBackup).toHaveBeenCalledWith(backupA.filename)
    expect(await screen.findByText('No backups yet')).toBeInTheDocument()
  })

  it('does not delete a backup when the confirmation is declined', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([backupA])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(TasksPage)

    await user.click(
      await screen.findByRole('button', {
        name: `Delete backup from ${formatDateTime(backupA.createdAt)}`,
      })
    )

    expect(deleteBackup).not.toHaveBeenCalled()
  })

  it('shows an error when deleting a backup fails', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([backupA])
    vi.mocked(deleteBackup).mockRejectedValue(new ApiError(500, 'Delete failed'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(TasksPage)

    await user.click(
      await screen.findByRole('button', {
        name: `Delete backup from ${formatDateTime(backupA.createdAt)}`,
      })
    )

    expect(await screen.findByText('Delete failed')).toBeInTheDocument()
  })

  it('links the JSON export and every CSV table download', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    render(TasksPage)

    const jsonLink = await screen.findByRole('link', { name: 'Download JSON' })
    expect(jsonLink.getAttribute('href')).toBe('/api/export/json')

    const csvLinks = screen.getAllByRole('link', { name: 'Download CSV' })
    expect(csvLinks).toHaveLength(8)
    expect(csvLinks.map((link) => link.getAttribute('href'))).toContain(
      '/api/export/csv/income-entries'
    )
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Income entries')).toBeInTheDocument()
  })

  it('loads and shows the notification schedule', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(getNotificationSchedule).mockResolvedValue({
      ...defaultNotificationSchedule,
      sendHour: 20,
      lastRunAt: '2026-01-27T03:00:00.000+00:00',
    })

    render(TasksPage)

    expect(await screen.findByText(/Last check:/)).toBeInTheDocument()
    const select = (await screen.findByLabelText('Check at')) as HTMLSelectElement
    expect(select.value).toBe('20')
  })

  it('shows an error when the notification schedule fails to load', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(getNotificationSchedule).mockRejectedValue(
      new ApiError(500, 'Could not load notification schedule')
    )

    render(TasksPage)

    expect(await screen.findByText('Could not load notification schedule')).toBeInTheDocument()
  })

  it('saves the notification schedule', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(getNotificationSchedule).mockResolvedValue(defaultNotificationSchedule)
    vi.mocked(updateNotificationSchedule).mockResolvedValue({
      ...defaultNotificationSchedule,
      sendHour: 18,
    })
    const user = userEvent.setup()
    render(TasksPage)

    await user.selectOptions(await screen.findByLabelText('Check at'), '18')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]!)

    expect(updateNotificationSchedule).toHaveBeenCalledWith({ sendHour: 18 })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows an error when saving the notification schedule fails', async () => {
    vi.mocked(getBackupSettings).mockResolvedValue(defaultSettings)
    vi.mocked(listBackups).mockResolvedValue([])
    vi.mocked(getNotificationSchedule).mockResolvedValue(defaultNotificationSchedule)
    vi.mocked(updateNotificationSchedule).mockRejectedValue(new ApiError(422, 'Invalid hour'))
    const user = userEvent.setup()
    render(TasksPage)

    await user.click((await screen.findAllByRole('button', { name: 'Save' }))[1]!)

    expect(await screen.findByText('Invalid hour')).toBeInTheDocument()
  })
})
