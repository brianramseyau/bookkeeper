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
  import { ApiError } from '$lib/api'
  import { toast } from 'svelte-sonner'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import DeviceList from '$lib/components/settings/DeviceList.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  let displayColor = $state(authState.user?.displayColor ?? '#4f46e5')
  let colorError = $state<string | null>(null)
  let savingColor = $state(false)

  let newEmail = $state(authState.user?.email ?? '')
  let emailPassword = $state('')
  let emailError = $state<string | null>(null)
  let savingEmail = $state(false)

  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let passwordError = $state<string | null>(null)
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
    try {
      preferences = await updateNotificationPreferences({
        enabled: notifyEnabled,
        leadDays,
        notifyUtilityBills,
        notifyRecurringBills,
        notifySubscriptions,
      })
      toast.success('Notification preferences saved')
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
        toast.success('Notifications disabled on this device')
      } else {
        await subscribeToPush()
        // subscribeToPush returns silently when permission isn't granted
        // (denied or dismissed), so report the outcome either way.
        if (pushState.subscribed) {
          toast.success('Notifications enabled on this device')
        } else {
          toast.error(
            "Notifications were not enabled - check this browser's notification permission."
          )
        }
      }
      await loadDevices()
    } catch (err) {
      devicesError = err instanceof ApiError ? err.message : 'Failed to update this device'
    } finally {
      togglingDevice = false
    }
  }

  async function handleDeleteDevice(device: PushSubscriptionRecord) {
    const label = device.userAgent ?? 'Unknown device'
    const confirmed = await confirmDestructive({
      title: `Remove ${label}?`,
      description: 'This device will stop receiving notifications until it is enabled again.',
    })
    if (!confirmed) return
    deletingDeviceId = device.id
    devicesError = null
    try {
      await deletePushSubscription(device.id)
      devices = devices.filter((d) => d.id !== device.id)
      toast.success('Device removed')
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
    try {
      const updated = await updateUser(authState.user.id, { displayColor })
      authState.user = { ...authState.user, displayColor: updated.displayColor }
      toast.success('Display color saved')
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
      toast.success('Email updated')
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
      toast.success('Password changed')
    } catch (err) {
      passwordError = err instanceof ApiError ? err.message : 'Failed to change password'
    } finally {
      savingPassword = false
    }
  }
</script>

<PageHeader title="Settings" description="Your display color, login details, and notifications." />

{#if colorError}
  <div class="mt-4"><ErrorMessage message={colorError} /></div>
{/if}

<Card class="mt-6 p-4">
  <h2 class="text-foreground text-lg font-semibold">Display color</h2>
  <p class="text-muted-foreground mt-1 text-sm">Shown next to your name in the header.</p>
  <form onsubmit={handleSaveColor} class="mt-3 flex flex-wrap items-end gap-3">
    <div class="flex flex-col gap-2">
      <Label for="settings-color">Color</Label>
      <input
        id="settings-color"
        type="color"
        bind:value={displayColor}
        class="border-input h-9 w-16 cursor-pointer rounded-md border bg-transparent p-1"
      />
    </div>
    <Button type="submit" disabled={savingColor}>
      {savingColor ? 'Saving…' : 'Save'}
    </Button>
  </form>
</Card>

{#if emailError}
  <div class="mt-4"><ErrorMessage message={emailError} /></div>
{/if}

<Card class="mt-4 p-4">
  <h2 class="text-foreground text-lg font-semibold">Email address</h2>
  <p class="text-muted-foreground mt-1 text-sm">Used to log in.</p>
  <form onsubmit={handleChangeEmail} class="mt-3 flex max-w-sm flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for="settings-email">New email</Label>
      <Input id="settings-email" type="email" autocomplete="email" bind:value={newEmail} />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="settings-email-password">Current password</Label>
      <Input
        id="settings-email-password"
        type="password"
        autocomplete="current-password"
        bind:value={emailPassword}
      />
    </div>
    <Button type="submit" disabled={savingEmail} class="self-start">
      {savingEmail ? 'Saving…' : 'Save'}
    </Button>
  </form>
</Card>

{#if passwordError}
  <div class="mt-4"><ErrorMessage message={passwordError} /></div>
{/if}

<Card class="mt-4 p-4">
  <h2 class="text-foreground text-lg font-semibold">Change password</h2>
  <form onsubmit={handleChangePassword} class="mt-3 flex max-w-sm flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for="settings-current-password">Current password</Label>
      <Input
        id="settings-current-password"
        type="password"
        autocomplete="current-password"
        bind:value={currentPassword}
      />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="settings-new-password">New password</Label>
      <Input
        id="settings-new-password"
        type="password"
        autocomplete="new-password"
        bind:value={newPassword}
      />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="settings-confirm-password">Confirm new password</Label>
      <Input
        id="settings-confirm-password"
        type="password"
        autocomplete="new-password"
        bind:value={confirmPassword}
      />
    </div>
    <Button type="submit" disabled={savingPassword} class="self-start">
      {savingPassword ? 'Saving…' : 'Change password'}
    </Button>
  </form>
</Card>

{#if preferencesError}
  <div class="mt-4"><ErrorMessage message={preferencesError} /></div>
{/if}

<Card class="mt-4 p-4">
  <h2 class="text-foreground text-lg font-semibold">Notifications</h2>
  <p class="text-muted-foreground mt-1 text-sm">
    Get a push notification for bills due soon or overdue. Opt-in per device and per bill type - the
    overall check schedule is set instance-wide on the <a
      href="/tasks"
      class="text-primary underline underline-offset-4">Tasks</a
    >
    page.
  </p>

  {#if preferencesLoading}
    <div class="mt-3"><LoadingSkeleton rows={3} /></div>
  {:else}
    <form onsubmit={handleSavePreferences} class="mt-3 flex max-w-sm flex-col gap-4">
      <label class="flex items-center gap-2">
        <input type="checkbox" class="size-4 rounded" bind:checked={notifyEnabled} />
        <span class="text-foreground text-sm font-medium">Enabled</span>
      </label>
      <div class="flex flex-col gap-2">
        <Label for="settings-lead-days">Remind me this many days before due</Label>
        <Input
          id="settings-lead-days"
          type="number"
          min="0"
          max="30"
          bind:value={leadDays}
          class="w-24"
        />
      </div>
      <fieldset class="flex flex-col gap-2">
        <legend class="text-foreground text-sm font-medium">Bill types</legend>
        <label class="flex items-center gap-2">
          <input type="checkbox" class="size-4 rounded" bind:checked={notifyUtilityBills} />
          <span class="text-foreground text-sm">Utility bills</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" class="size-4 rounded" bind:checked={notifyRecurringBills} />
          <span class="text-foreground text-sm">Recurring bills</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" class="size-4 rounded" bind:checked={notifySubscriptions} />
          <span class="text-foreground text-sm">Subscriptions</span>
        </label>
      </fieldset>
      <Button type="submit" disabled={savingPreferences} class="self-start">
        {savingPreferences ? 'Saving…' : 'Save'}
      </Button>
    </form>
  {/if}
</Card>

{#if devicesError}
  <div class="mt-4"><ErrorMessage message={devicesError} /></div>
{/if}

<Card class="mt-4 p-4">
  <h2 class="text-foreground text-lg font-semibold">Devices</h2>
  <p class="text-muted-foreground mt-1 text-sm">
    Each browser or device that has notifications enabled.
  </p>

  {#if !pushState.supported}
    <p class="text-muted-foreground mt-3 text-sm">
      {#if !pushState.secureContext}
        Push notifications need this app served over HTTPS (or accessed as "localhost") - put a
        TLS-terminating reverse proxy in front of the container to use this feature over the
        network.
      {:else}
        This browser doesn't support push notifications.
      {/if}
    </p>
  {:else}
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <Button onclick={handleToggleDevice} disabled={togglingDevice}>
        {#if togglingDevice}
          Working…
        {:else if pushState.subscribed}
          Disable on this device
        {:else}
          Enable on this device
        {/if}
      </Button>
      <Button variant="outline" onclick={handleSendTest} disabled={testSending}>
        {testSending ? 'Sending…' : 'Send test notification'}
      </Button>
    </div>
  {/if}

  {#if testMessage}
    <p class="text-muted-foreground mt-3 text-sm">{testMessage}</p>
  {/if}

  <DeviceList {devices} loading={devicesLoading} {deletingDeviceId} onDelete={handleDeleteDevice} />
</Card>
