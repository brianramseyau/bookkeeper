<script lang="ts">
  import { authState } from '$lib/stores/auth.svelte'
  import { updateUser, changePassword, changeEmail } from '$lib/api/users'
  import { ApiError } from '$lib/api'

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

<svelte:head>
  <title>Settings · Bookkeeper</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Display color</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Shown next to your name in the header.</p>

{#if colorError}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{colorError}</p>
{/if}
{#if colorSuccess}
  <p class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
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
  <button
    type="submit"
    disabled={savingColor}
    class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    {savingColor ? 'Saving…' : 'Save'}
  </button>
</form>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Email address</h2>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Used to log in.</p>

{#if emailError}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{emailError}</p>
{/if}
{#if emailSuccess}
  <p class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Email updated.</p>
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
  <button
    type="submit"
    disabled={savingEmail}
    class="self-start rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    {savingEmail ? 'Saving…' : 'Save'}
  </button>
</form>

<h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Change password</h2>

{#if passwordError}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
{/if}
{#if passwordSuccess}
  <p class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Password changed.</p>
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
  <button
    type="submit"
    disabled={savingPassword}
    class="self-start rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
  >
    {savingPassword ? 'Saving…' : 'Change password'}
  </button>
</form>
