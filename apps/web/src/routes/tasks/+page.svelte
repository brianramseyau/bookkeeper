<script lang="ts">
  import { onMount } from 'svelte'
  import {
    getBackupSettings,
    updateBackupSettings,
    type BackupFrequency,
    type BackupSettings,
  } from '$lib/api/backup-settings'
  import { createBackup, deleteBackup, listBackups, type Backup } from '$lib/api/backups'
  import {
    getNotificationSchedule,
    updateNotificationSchedule,
    type NotificationSchedule,
  } from '$lib/api/notification-schedule'
  import { formatDateTime } from '$lib/format'
  import { ApiError } from '$lib/api'
  import { toast } from 'svelte-sonner'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import BackupList from '$lib/components/tasks/BackupList.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  const FREQUENCY_OPTIONS: { value: BackupFrequency; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly (Sunday)' },
    { value: 'monthly', label: 'Monthly (1st)' },
  ]

  const EXPORT_TABLES: { key: string; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'utilities', label: 'Utilities' },
    { key: 'utility-bills', label: 'Utility bills' },
    { key: 'recurring-bills', label: 'Recurring bills' },
    { key: 'subscriptions', label: 'Personal subscriptions' },
    { key: 'expense-actuals', label: 'Expense actuals' },
    { key: 'income-sources', label: 'Income sources' },
    { key: 'income-entries', label: 'Income entries' },
  ]

  let settings = $state<BackupSettings | null>(null)
  let enabled = $state(true)
  let frequency = $state<BackupFrequency>('daily')
  let timeOfDay = $state('01:00')
  let retentionCount = $state(7)
  let settingsLoading = $state(true)
  let settingsError = $state<string | null>(null)
  let savingSettings = $state(false)

  let backups = $state<Backup[]>([])
  let backupsLoading = $state(true)
  let backupsError = $state<string | null>(null)
  let creatingBackup = $state(false)
  let deletingFilename = $state<string | null>(null)

  const automaticBackups = $derived(backups.filter((b) => b.source === 'automatic'))
  const manualBackups = $derived(backups.filter((b) => b.source === 'manual'))
  // Driven by the file list (the most recent backup of any source), not a
  // separate "last run" field on the schedule - there isn't one, since due-
  // ness is derived from the backup files themselves (see
  // #services/backup_scheduler on the API).
  const lastBackup = $derived(backups[0] ?? null)

  const SEND_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' }),
  }))

  let notificationSchedule = $state<NotificationSchedule | null>(null)
  let sendHour = $state(8)
  let notificationScheduleLoading = $state(true)
  let notificationScheduleError = $state<string | null>(null)
  let savingNotificationSchedule = $state(false)

  onMount(() => {
    void loadSettings()
    void loadBackups()
    void loadNotificationSchedule()
  })

  async function loadSettings() {
    settingsLoading = true
    settingsError = null
    try {
      settings = await getBackupSettings()
      enabled = settings.enabled
      frequency = settings.frequency
      timeOfDay = settings.timeOfDay
      retentionCount = settings.retentionCount
    } catch (err) {
      settingsError = err instanceof ApiError ? err.message : 'Failed to load backup schedule'
    } finally {
      settingsLoading = false
    }
  }

  async function loadBackups() {
    backupsLoading = true
    backupsError = null
    try {
      backups = await listBackups()
    } catch (err) {
      backupsError = err instanceof ApiError ? err.message : 'Failed to load backups'
    } finally {
      backupsLoading = false
    }
  }

  async function handleSaveSettings(event: SubmitEvent) {
    event.preventDefault()
    savingSettings = true
    settingsError = null
    try {
      settings = await updateBackupSettings({ enabled, frequency, timeOfDay, retentionCount })
      toast.success('Backup schedule saved')
    } catch (err) {
      settingsError = err instanceof ApiError ? err.message : 'Failed to save backup schedule'
    } finally {
      savingSettings = false
    }
  }

  async function handleBackupNow() {
    creatingBackup = true
    backupsError = null
    try {
      await createBackup()
      await loadBackups()
      toast.success('Backup created')
    } catch (err) {
      backupsError = err instanceof ApiError ? err.message : 'Failed to create backup'
    } finally {
      creatingBackup = false
    }
  }

  async function handleDeleteBackup(backup: Backup) {
    const confirmed = await confirmDestructive({
      title: `Delete "${backup.filename}"?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    deletingFilename = backup.filename
    backupsError = null
    try {
      await deleteBackup(backup.filename)
      backups = backups.filter((b) => b.filename !== backup.filename)
      toast.success('Backup deleted')
    } catch (err) {
      backupsError = err instanceof ApiError ? err.message : 'Failed to delete backup'
    } finally {
      deletingFilename = null
    }
  }

  async function loadNotificationSchedule() {
    notificationScheduleLoading = true
    notificationScheduleError = null
    try {
      notificationSchedule = await getNotificationSchedule()
      sendHour = notificationSchedule.sendHour
    } catch (err) {
      notificationScheduleError =
        err instanceof ApiError ? err.message : 'Failed to load notification schedule'
    } finally {
      notificationScheduleLoading = false
    }
  }

  async function handleSaveNotificationSchedule(event: SubmitEvent) {
    event.preventDefault()
    savingNotificationSchedule = true
    notificationScheduleError = null
    try {
      notificationSchedule = await updateNotificationSchedule({ sendHour })
      toast.success('Notification schedule saved')
    } catch (err) {
      notificationScheduleError =
        err instanceof ApiError ? err.message : 'Failed to save notification schedule'
    } finally {
      savingNotificationSchedule = false
    }
  }
</script>

<PageHeader
  title="Tasks"
  description="Backups, data export, and the shared bill-reminder schedule."
/>

{#if settingsError}
  <div class="mt-4"><ErrorMessage message={settingsError} /></div>
{/if}

<Card class="mt-6 p-4">
  <h2 class="text-foreground text-lg font-semibold">Backup schedule</h2>
  <p class="text-muted-foreground mt-1 text-sm">
    Automatically snapshot the database on a schedule. Only the newest automated backups (up to
    "Backups to keep") are kept - older ones are deleted automatically.
  </p>

  {#if settingsLoading}
    <div class="mt-3"><LoadingSkeleton rows={2} /></div>
  {:else}
    <form onsubmit={handleSaveSettings} class="mt-3 flex flex-wrap items-end gap-4">
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="border-input accent-violet size-4 rounded"
          bind:checked={enabled}
        />
        <span class="text-foreground text-sm font-medium">Enabled</span>
      </label>
      <div class="flex flex-col gap-2">
        <Label for="backup-frequency">Frequency</Label>
        <select
          id="backup-frequency"
          bind:value={frequency}
          class="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
        >
          {#each FREQUENCY_OPTIONS as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="backup-time">Time of day</Label>
        <Input id="backup-time" type="time" bind:value={timeOfDay} class="w-32" />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="backup-retention">Backups to keep</Label>
        <Input
          id="backup-retention"
          type="number"
          min="1"
          max="60"
          bind:value={retentionCount}
          class="w-24"
        />
      </div>
      <Button type="submit" disabled={savingSettings}>
        {savingSettings ? 'Saving…' : 'Save'}
      </Button>
      {#if lastBackup}
        <span class="text-muted-foreground text-xs">
          Last backup: {formatDateTime(lastBackup.createdAt)}
        </span>
      {/if}
    </form>
  {/if}
</Card>

{#if backupsError}
  <div class="mt-4"><ErrorMessage message={backupsError} /></div>
{/if}

<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-foreground text-lg font-semibold">Backups</h2>
  <Button variant="outline" onclick={handleBackupNow} disabled={creatingBackup}>
    {creatingBackup ? 'Backing up…' : 'Backup now'}
  </Button>
</div>

{#if backupsLoading}
  <div class="mt-3"><LoadingSkeleton rows={2} /></div>
{:else}
  <h3 class="text-foreground mt-4 text-sm font-semibold">Automated backups</h3>
  {#if automaticBackups.length === 0}
    <p class="text-muted-foreground mt-2 text-sm">No automated backups yet</p>
  {:else}
    <BackupList backups={automaticBackups} {deletingFilename} onDelete={handleDeleteBackup} />
  {/if}

  <h3 class="text-foreground mt-6 text-sm font-semibold">Manual backups</h3>
  <p class="text-muted-foreground mt-1 text-sm">
    Not subject to the "Backups to keep" limit above - kept until you delete them yourself.
  </p>
  {#if manualBackups.length === 0}
    <p class="text-muted-foreground mt-2 text-sm">No manual backups yet</p>
  {:else}
    <BackupList backups={manualBackups} {deletingFilename} onDelete={handleDeleteBackup} />
  {/if}
{/if}

<div class="mt-8">
  <h2 class="text-foreground text-lg font-semibold">Export</h2>
  <p class="text-muted-foreground mt-1 text-sm">
    Download your data for backup or analysis in another tool. This is a snapshot, not a live backup
    - use Backups above for the recommended way to back up the whole app.
  </p>

  <Card class="mt-3 p-4">
    <h3 class="text-foreground text-sm font-semibold">Everything, as JSON</h3>
    <p class="text-muted-foreground mt-1 text-sm">
      A single file with every table, useful for a full backup or import into another tool.
    </p>
    <Button href="/api/export/json" class="mt-3">
      Download JSON
    </Button>
  </Card>

  <h3 class="text-foreground mt-6 text-sm font-semibold">Individual tables, as CSV</h3>
  <Card class="mt-3 overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <tbody>
        {#each EXPORT_TABLES as table (table.key)}
          <tr class="border-border border-b last:border-0">
            <td class="text-foreground px-3 py-2 font-medium">{table.label}</td>
            <td class="px-3 py-2 text-right">
              <a
                href="/api/export/csv/{table.key}"
                class="text-primary text-xs font-medium hover:underline"
              >
                Download CSV
              </a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
</div>

{#if notificationScheduleError}
  <div class="mt-4"><ErrorMessage message={notificationScheduleError} /></div>
{/if}

<Card class="mt-8 p-4">
  <h2 class="text-foreground text-lg font-semibold">Notification schedule</h2>
  <p class="text-muted-foreground mt-1 text-sm">
    What time of day the shared bill-reminder check runs. Each person opts in and picks which bill
    types to be notified about from their own
    <a href="/settings" class="text-primary underline-offset-4 hover:underline">Settings</a> page.
  </p>

  {#if notificationScheduleLoading}
    <div class="mt-3"><LoadingSkeleton rows={2} /></div>
  {:else}
    <form onsubmit={handleSaveNotificationSchedule} class="mt-3 flex flex-wrap items-end gap-4">
      <div class="flex flex-col gap-2">
        <Label for="notification-hour">Check at</Label>
        <select
          id="notification-hour"
          bind:value={sendHour}
          class="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
        >
          {#each SEND_HOUR_OPTIONS as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <Button type="submit" disabled={savingNotificationSchedule}>
        {savingNotificationSchedule ? 'Saving…' : 'Save'}
      </Button>
      {#if notificationSchedule?.lastRunAt}
        <span class="text-muted-foreground text-xs">
          Last check: {formatDateTime(notificationSchedule.lastRunAt)}
        </span>
      {/if}
    </form>
  {/if}
</Card>
