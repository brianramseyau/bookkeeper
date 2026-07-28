<script lang="ts">
  import { onMount } from 'svelte'
  import {
    getBackupSettings,
    updateBackupSettings,
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

  const INTERVAL_OPTIONS = [
    { value: 6, label: 'Every 6 hours' },
    { value: 12, label: 'Every 12 hours' },
    { value: 24, label: 'Daily' },
    { value: 48, label: 'Every 2 days' },
    { value: 168, label: 'Weekly' },
  ]

  const EXPORT_TABLES: { key: string; label: string }[] = [
    { key: 'categories', label: 'Categories' },
    { key: 'utilities', label: 'Utilities' },
    { key: 'utility-bills', label: 'Utility bills' },
    { key: 'recurring-bills', label: 'Recurring bills' },
    { key: 'subscriptions', label: 'Personal subscriptions' },
    { key: 'category-actuals', label: 'Category actuals' },
    { key: 'income-sources', label: 'Income sources' },
    { key: 'income-entries', label: 'Income entries' },
  ]

  let settings = $state<BackupSettings | null>(null)
  let enabled = $state(true)
  let intervalHours = $state(24)
  let retentionDays = $state(7)
  let settingsLoading = $state(true)
  let settingsError = $state<string | null>(null)
  let savingSettings = $state(false)
  let settingsSaved = $state(false)

  let backups = $state<Backup[]>([])
  let backupsLoading = $state(true)
  let backupsError = $state<string | null>(null)
  let creatingBackup = $state(false)
  let deletingFilename = $state<string | null>(null)

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
      intervalHours = settings.intervalHours
      retentionDays = settings.retentionDays
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
      settings = await updateBackupSettings({ enabled, intervalHours, retentionDays })
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
      // A manual backup also stamps the schedule's lastRunAt server-side -
      // refresh so that's reflected without a full page reload.
      settings = await getBackupSettings()
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

<svelte:head>
  <title>Tasks · Bookkeeper</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tasks</h1>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Backup schedule</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Automatically snapshot the database on a schedule. Old backups past the retention window are
  deleted automatically.
</p>

{#if settingsError}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{settingsError}</p>
{/if}
{#if settingsSaved}
  <p class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
{/if}

{#if settingsLoading}
  <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else}
  <form
    onsubmit={handleSaveSettings}
    class="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        bind:checked={enabled}
        class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
      />
      <span class="text-sm font-medium text-slate-900 dark:text-slate-100">Enabled</span>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Frequency</span>
      <select
        bind:value={intervalHours}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {#each INTERVAL_OPTIONS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Keep for (days)</span>
      <input
        type="number"
        min="1"
        max="365"
        bind:value={retentionDays}
        class="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <button
      type="submit"
      disabled={savingSettings}
      class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {savingSettings ? 'Saving…' : 'Save'}
    </button>
    {#if settings?.lastRunAt}
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Last backup: {formatDateTime(settings.lastRunAt)}
      </span>
    {/if}
  </form>
{/if}

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Backups</h2>

{#if backupsError}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{backupsError}</p>
{/if}

<div class="mt-3">
  <button
    type="button"
    onclick={handleBackupNow}
    disabled={creatingBackup}
    class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    {creatingBackup ? 'Backing up…' : 'Backup now'}
  </button>
</div>

{#if backupsLoading}
  <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else if backups.length === 0}
  <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">No backups yet</p>
{:else}
  <div
    class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <table class="w-full border-collapse text-sm">
      <tbody>
        {#each backups as backup (backup.filename)}
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
              <button
                type="button"
                onclick={() => handleDeleteBackup(backup)}
                disabled={deletingFilename === backup.filename}
                class="-my-1 ml-2 p-1 text-xs text-slate-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-600 dark:hover:text-red-400"
              >
                Delete
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Export</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Download your data for backup or analysis in another tool. This is a snapshot, not a live backup -
  use Backups above for the recommended way to back up the whole app.
</p>

<div
  class="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
>
  <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Everything, as JSON</h3>
  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
    A single file with every table, useful for a full backup or import into another tool.
  </p>
  <a
    href="/api/export/json"
    class="mt-3 inline-flex items-center gap-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    Download JSON
  </a>
</div>

<h3 class="mt-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
  Individual tables, as CSV
</h3>
<div
  class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
>
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
</div>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Notification schedule</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  What time of day the shared bill-reminder check runs. Each person opts in and picks which bill
  types to be notified about from their own <a href="/settings" class="underline">Settings</a>
  page.
</p>

{#if notificationScheduleError}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{notificationScheduleError}</p>
{/if}
{#if notificationScheduleSaved}
  <p class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
{/if}

{#if notificationScheduleLoading}
  <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
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
    <button
      type="submit"
      disabled={savingNotificationSchedule}
      class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {savingNotificationSchedule ? 'Saving…' : 'Save'}
    </button>
    {#if notificationSchedule?.lastRunAt}
      <span class="text-xs text-slate-400 dark:text-slate-500">
        Last check: {formatDateTime(notificationSchedule.lastRunAt)}
      </span>
    {/if}
  </form>
{/if}
