<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth.svelte'
  import { pushState, subscribeToPush, unsubscribeFromPush } from '$lib/stores/push.svelte'
  import { updateUser, changePassword, changeEmail } from '$lib/api/users'
  import {
    getNotificationPreferences,
    updateNotificationPreferences,
    type NotificationPreferences,
  } from '$lib/api/notification-preferences'
  import {
    listPushSubscriptions,
    deletePushSubscription,
    sendTestPushNotification,
    type PushSubscriptionRecord,
  } from '$lib/api/push-subscriptions'
  import { formatDateTime } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import SuccessMessage from '$lib/components/SuccessMessage.svelte'
  import TextActionButton from '$lib/components/TextActionButton.svelte'

  let displayColor = $state(authState.user?.displayColor ?? '#4f46e5')
  let colorError = $state<string | null>(null)
  let colorSuccess = $state(false)
  let savingColor = $state(false)

  let newEmail = $state(authState.user?.email ?? '')
  let emailPassword = $state('')
  let emailError = $state<string | null>(null)
  let emailSuccess = $state(false)
  let savingEmail = $state(false)

  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let passwordError = $state<string | null>(null)
  let passwordSuccess = $state(false)
  let savingPassword = $state(false)

  let preferences = $state<NotificationPreferences | null>(null)
  let notifyEnabled = $state(false)
  let leadDays = $state(3)
  let notifyUtilityBills = $state(true)
  let notifyRecurringBills = $state(true)
  let notifySubscriptions = $state(true)
  let preferencesLoading = $state(true)
  let preferencesError = $state<string | null>(null)
  let savingPreferences = $state(false)
  let preferencesSaved = $state(false)

  let devices = $state<PushSubscriptionRecord[]>([])
  let devicesLoading = $state(true)
  let devicesError = $state<string | null>(null)
  let togglingDevice = $state(false)
  let deletingDeviceId = $state<number | null>(null)
  let testSending = $state(false)
  let testMessage = $state<string | null>(null)

  onMount(() => {
    void loadPreferences()
    void loadDevices()
  })

  async function loadPreferences() {
    preferencesLoading = true
    preferencesError = null
    try {
      preferences = await getNotificationPreferences()
      notifyEnabled = preferences.enabled
      leadDays = preferences.leadDays
      notifyUtilityBills = preferences.notifyUtilityBills
      notifyRecurringBills = preferences.notifyRecurringBills
      notifySubscriptions = preferences.notifySubscriptions
    } catch (err) {
      preferencesError = err instanceof ApiError ? err.message : 'Failed to load preferences'
    } finally {
      preferencesLoading = false
    }
  }

  async function loadDevices() {
    devicesLoading = true
    devicesError = null
    try {
      devices = await listPushSubscriptions()
    } catch (err) {
      devicesError = err instanceof ApiError ? err.message : 'Failed to load devices'
    } finally {
      devicesLoading = false
    }
  }

  async function handleSavePreferences(event: SubmitEvent) {
    event.preventDefault()
    savingPreferences = true
    preferencesError = null
    preferencesSaved = false
    try {
      preferences = await updateNotificationPreferences({
        enabled: notifyEnabled,
        leadDays,
        notifyUtilityBills,
        notifyRecurringBills,
        notifySubscriptions,
      })
      preferencesSaved = true
    } catch (err) {
      preferencesError = err instanceof ApiError ? err.message : 'Failed to save preferences'
    } finally {
      savingPreferences = false
    }
  }

  async function handleToggleDevice() {
    togglingDevice = true
    devicesError = null
    try {
      if (pushState.subscribed) {
        await unsubscribeFromPush()
      } else {
        await subscribeToPush()
      }
      await loadDevices()
    } catch (err) {
      devicesError = err instanceof ApiError ? err.message : 'Failed to update this device'
    } finally {
      togglingDevice = false
    }
  }

  async function handleDeleteDevice(device: PushSubscriptionRecord) {
    deletingDeviceId = device.id
    devicesError = null
    try {
      await deletePushSubscription(device.id)
      devices = devices.filter((d) => d.id !== device.id)
    } catch (err) {
      devicesError = err instanceof ApiError ? err.message : 'Failed to remove device'
    } finally {
      deletingDeviceId = null
    }
  }

  async function handleSendTest() {
    testSending = true
    testMessage = null
    devicesError = null
    try {
      const result = await sendTestPushNotification()
      if (result.sent > 0) {
        testMessage = 'Test notification sent - check this device.'
      } else if (result.failed > 0) {
        testMessage = `The push service rejected the notification for ${result.failed === 1 ? 'this device' : `${result.failed} devices`} - check the server logs for details.`
      } else {
        testMessage = 'No active devices to send to - enable notifications on this device first.'
      }
    } catch (err) {
      devicesError = err instanceof ApiError ? err.message : 'Failed to send test notification'
    } finally {
      testSending = false
    }
  }

  async function handleSaveColor(event: SubmitEvent) {
    event.preventDefault()
    if (!authState.user) return
    savingColor = true
    colorError = null
    colorSuccess = false
    try {
      const updated = await updateUser(authState.user.id, { displayColor })
      authState.user = { ...authState.user, displayColor: updated.displayColor }
      colorSuccess = true
    } catch (err) {
      colorError = err instanceof ApiError ? err.message : 'Failed to save display color'
    } finally {
      savingColor = false
    }
  }

  async function handleChangeEmail(event: SubmitEvent) {
    event.preventDefault()
    if (!authState.user) return
    emailError = null
    emailSuccess = false
    if (!newEmail.trim()) {
      emailError = 'Email is required'
      return
    }
    savingEmail = true
    try {
      const updated = await changeEmail(authState.user.id, {
        currentPassword: emailPassword,
        newEmail: newEmail.trim(),
      })
      authState.user = { ...authState.user, email: updated.email }
      emailPassword = ''
      emailSuccess = true
    } catch (err) {
      emailError = err instanceof ApiError ? err.message : 'Failed to change email'
    } finally {
      savingEmail = false
    }
  }

  async function handleChangePassword(event: SubmitEvent) {
    event.preventDefault()
    if (!authState.user) return
    passwordError = null
    passwordSuccess = false
    if (newPassword.length < 8) {
      passwordError = 'New password must be at least 8 characters'
      return
    }
    if (newPassword !== confirmPassword) {
      passwordError = 'New passwords do not match'
      return
    }
    savingPassword = true
    try {
      await changePassword(authState.user.id, { currentPassword, newPassword })
      currentPassword = ''
      newPassword = ''
      confirmPassword = ''
      passwordSuccess = true
    } catch (err) {
      passwordError = err instanceof ApiError ? err.message : 'Failed to change password'
    } finally {
      savingPassword = false
    }
  }
</script>

<PageHead title="Settings" />

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Display color</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Shown next to your name in the header.
</p>

{#if colorError}
  <ErrorMessage message={colorError} />
{/if}
{#if colorSuccess}
  <SuccessMessage message="Saved." />
{/if}

<form
  onsubmit={handleSaveColor}
  class="mt-3 flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Color</span>
    <input
      type="color"
      bind:value={displayColor}
      class="h-9 w-16 cursor-pointer rounded border border-slate-300 bg-transparent p-0 dark:border-slate-600"
    />
  </label>
  <PrimaryButton type="submit" disabled={savingColor}>
    {savingColor ? 'Saving…' : 'Save'}
  </PrimaryButton>
</form>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Email address</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Used to log in.</p>

{#if emailError}
  <ErrorMessage message={emailError} />
{/if}
{#if emailSuccess}
  <SuccessMessage message="Email updated." />
{/if}

<form
  onsubmit={handleChangeEmail}
  class="mt-3 flex max-w-sm flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">New email</span>
    <input
      type="email"
      autocomplete="email"
      bind:value={newEmail}
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Current password</span>
    <input
      type="password"
      autocomplete="current-password"
      bind:value={emailPassword}
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <PrimaryButton type="submit" disabled={savingEmail} class="self-start">
    {savingEmail ? 'Saving…' : 'Save'}
  </PrimaryButton>
</form>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Change password</h2>

{#if passwordError}
  <ErrorMessage message={passwordError} />
{/if}
{#if passwordSuccess}
  <SuccessMessage message="Password changed." />
{/if}

<form
  onsubmit={handleChangePassword}
  class="mt-3 flex max-w-sm flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Current password</span>
    <input
      type="password"
      autocomplete="current-password"
      bind:value={currentPassword}
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">New password</span>
    <input
      type="password"
      autocomplete="new-password"
      bind:value={newPassword}
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Confirm new password</span>
    <input
      type="password"
      autocomplete="new-password"
      bind:value={confirmPassword}
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <PrimaryButton type="submit" disabled={savingPassword} class="self-start">
    {savingPassword ? 'Saving…' : 'Change password'}
  </PrimaryButton>
</form>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Notifications</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Get a push notification for bills due soon or overdue. Opt-in per device and per bill type - the
  overall check schedule is set instance-wide on the <a href="/tasks" class="underline">Tasks</a>
  page.
</p>

{#if preferencesError}
  <ErrorMessage message={preferencesError} />
{/if}
{#if preferencesSaved}
  <SuccessMessage message="Saved." />
{/if}

{#if preferencesLoading}
  <LoadingIndicator class="mt-3" />
{:else}
  <form
    onsubmit={handleSavePreferences}
    class="mt-3 flex max-w-sm flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        bind:checked={notifyEnabled}
        class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
      />
      <span class="text-sm font-medium text-slate-900 dark:text-slate-100">Enabled</span>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
        >Remind me this many days before due</span
      >
      <input
        type="number"
        min="0"
        max="30"
        bind:value={leadDays}
        class="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Bill types</span>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={notifyUtilityBills}
          class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
        />
        <span class="text-sm text-slate-900 dark:text-slate-100">Utility bills</span>
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={notifyRecurringBills}
          class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
        />
        <span class="text-sm text-slate-900 dark:text-slate-100">Recurring bills</span>
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={notifySubscriptions}
          class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
        />
        <span class="text-sm text-slate-900 dark:text-slate-100">Subscriptions</span>
      </label>
    </div>
    <PrimaryButton type="submit" disabled={savingPreferences} class="self-start">
      {savingPreferences ? 'Saving…' : 'Save'}
    </PrimaryButton>
  </form>
{/if}

{#if !pushState.supported}
  <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">
    {#if !pushState.secureContext}
      Push notifications need this app served over HTTPS (or accessed as "localhost") - put a
      TLS-terminating reverse proxy in front of the container to use this feature over the network.
    {:else}
      This browser doesn't support push notifications.
    {/if}
  </p>
{:else}
  <div class="mt-3 flex flex-wrap items-center gap-3">
    <PrimaryButton onclick={handleToggleDevice} disabled={togglingDevice}>
      {#if togglingDevice}
        Working…
      {:else if pushState.subscribed}
        Disable on this device
      {:else}
        Enable on this device
      {/if}
    </PrimaryButton>
    <button
      type="button"
      onclick={handleSendTest}
      disabled={testSending}
      class="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {testSending ? 'Sending…' : 'Send test notification'}
    </button>
  </div>
{/if}

{#if testMessage}
  <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{testMessage}</p>
{/if}
{#if devicesError}
  <ErrorMessage message={devicesError} />
{/if}

{#if devicesLoading}
  <LoadingIndicator class="mt-3" />
{:else if devices.length === 0}
  <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">No devices registered yet</p>
{:else}
  <Card class="mt-3 overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <tbody>
        {#each devices as device (device.id)}
          <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
            <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
              {device.userAgent ?? 'Unknown device'}
            </td>
            <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
              {formatDateTime(device.createdAt)}
            </td>
            <td class="px-3 py-2 text-right">
              <TextActionButton
                variant="danger"
                class="-m-1 p-1"
                disabled={deletingDeviceId === device.id}
                onclick={() => handleDeleteDevice(device)}
              >
                Remove
              </TextActionButton>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
{/if}
