<script lang="ts">
  import { onMount } from 'svelte'
  import {
    getBackupSettings,
    updateBackupSettings,
    type BackupFrequency,
    type BackupSettings,
  } from '$lib/api/backup-settings'
  import {
    backupDownloadUrl,
    createBackup,
    deleteBackup,
    listBackups,
    type Backup,
  } from '$lib/api/backups'
  import {
    getNotificationSchedule,
    updateNotificationSchedule,
    type NotificationSchedule,
  } from '$lib/api/notification-schedule'
  import { formatDateTime, formatFileSize } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import { Button } from '$lib/components/ui/button'
  import SuccessMessage from '$lib/components/SuccessMessage.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiDelete } from '@mdi/js'

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
  let settingsSaved = $state(false)

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
  let notificationScheduleSaved = $state(false)

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
    settingsSaved = false
    try {
      settings = await updateBackupSettings({ enabled, frequency, timeOfDay, retentionCount })
      settingsSaved = true
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
    } catch (err) {
      backupsError = err instanceof ApiError ? err.message : 'Failed to create backup'
    } finally {
      creatingBackup = false
    }
  }

  async function handleDeleteBackup(backup: Backup) {
    if (!confirm(`Permanently delete "${backup.filename}"? This cannot be undone.`)) return
    deletingFilename = backup.filename
    backupsError = null
    try {
      await deleteBackup(backup.filename)
      backups = backups.filter((b) => b.filename !== backup.filename)
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
    notificationScheduleSaved = false
    try {
      notificationSchedule = await updateNotificationSchedule({ sendHour })
      notificationScheduleSaved = true
    } catch (err) {
      notificationScheduleError =
        err instanceof ApiError ? err.message : 'Failed to save notification schedule'
    } finally {
      savingNotificationSchedule = false
    }
  }
</script>

<PageHead title="Tasks" />

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tasks</h1>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Backup schedule</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Automatically snapshot the database on a schedule. Only the newest automated backups (up to
  "Backups to keep") are kept - older ones are deleted automatically.
</p>

{#if settingsError}
  <ErrorMessage message={settingsError} />
{/if}
{#if settingsSaved}
  <SuccessMessage message="Saved." />
{/if}

{#if settingsLoading}
  <LoadingIndicator class="mt-3" />
{:else}
  <form
    onsubmit={handleSaveSettings}
    class="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        bind:checked={enabled}
        class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
      />
      <span class="text-sm font-medium text-slate-900 dark:text-slate-100">Enabled</span>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Frequency</span>
      <select
        bind:value={frequency}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {#each FREQUENCY_OPTIONS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Time of day</span>
      <input
        type="time"
        bind:value={timeOfDay}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Backups to keep</span>
      <input
        type="number"
        min="1"
        max="60"
        bind:value={retentionCount}
        class="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <Button type="submit" disabled={savingSettings}>
      {savingSettings ? 'Saving…' : 'Save'}
    </Button>
    {#if lastBackup}
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Last backup: {formatDateTime(lastBackup.createdAt)}
      </span>
    {/if}
  </form>
{/if}

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Backups</h2>

{#if backupsError}
  <ErrorMessage message={backupsError} />
{/if}

<div class="mt-3">
  <Button onclick={handleBackupNow} disabled={creatingBackup}>
    {creatingBackup ? 'Backing up…' : 'Backup now'}
  </Button>
</div>

{#snippet backupTable(list: Backup[])}
  <Card class="mt-3 overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <tbody>
        {#each list as backup (backup.filename)}
          <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
            <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
              {formatDateTime(backup.createdAt)}
            </td>
            <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
              {formatFileSize(backup.sizeBytes)}
            </td>
            <td class="px-3 py-2 text-right">
              <a
                href={backupDownloadUrl(backup.filename)}
                class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Download
              </a>
              <IconActionButton
                variant="danger"
                disabled={deletingFilename === backup.filename}
                label="Delete backup from {formatDateTime(backup.createdAt)}"
                path={mdiDelete}
                onclick={() => handleDeleteBackup(backup)}
              />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
{/snippet}

{#if backupsLoading}
  <LoadingIndicator class="mt-3" />
{:else}
  <h3 class="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Automated backups</h3>
  {#if automaticBackups.length === 0}
    <p class="mt-2 text-sm text-slate-400 dark:text-slate-500">No automated backups yet</p>
  {:else}
    {@render backupTable(automaticBackups)}
  {/if}

  <h3 class="mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">Manual backups</h3>
  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
    Not subject to the "Backups to keep" limit above - kept until you delete them yourself.
  </p>
  {#if manualBackups.length === 0}
    <p class="mt-2 text-sm text-slate-400 dark:text-slate-500">No manual backups yet</p>
  {:else}
    {@render backupTable(manualBackups)}
  {/if}
{/if}

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Export</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Download your data for backup or analysis in another tool. This is a snapshot, not a live backup -
  use Backups above for the recommended way to back up the whole app.
</p>

<Card class="mt-3 p-4">
  <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Everything, as JSON</h3>
  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
    A single file with every table, useful for a full backup or import into another tool.
  </p>
  <Button href="/api/export/json" size="lg" class="mt-3 inline-flex items-center gap-1">
    Download JSON
  </Button>
</Card>

<h3 class="mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
  Individual tables, as CSV
</h3>
<Card class="mt-3 overflow-x-auto">
  <table class="w-full border-collapse text-sm">
    <tbody>
      {#each EXPORT_TABLES as table (table.key)}
        <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
          <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{table.label}</td>
          <td class="px-3 py-2 text-right">
            <a
              href="/api/export/csv/{table.key}"
              class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Download CSV
            </a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</Card>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Notification schedule</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  What time of day the shared bill-reminder check runs. Each person opts in and picks which bill
  types to be notified about from their own <a href="/settings" class="underline">Settings</a>
  page.
</p>

{#if notificationScheduleError}
  <ErrorMessage message={notificationScheduleError} />
{/if}
{#if notificationScheduleSaved}
  <SuccessMessage message="Saved." />
{/if}

{#if notificationScheduleLoading}
  <LoadingIndicator class="mt-3" />
{:else}
  <form
    onsubmit={handleSaveNotificationSchedule}
    class="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Check at</span>
      <select
        bind:value={sendHour}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {#each SEND_HOUR_OPTIONS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
    <Button type="submit" disabled={savingNotificationSchedule}>
      {savingNotificationSchedule ? 'Saving…' : 'Save'}
    </Button>
    {#if notificationSchedule?.lastRunAt}
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Last check: {formatDateTime(notificationSchedule.lastRunAt)}
      </span>
    {/if}
  </form>
{/if}
