<script lang="ts">
  import { goto } from '$app/navigation'
  import { authState, login } from '$lib/stores/auth.svelte'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'

  let email = $state('')
  let password = $state('')
  let error = $state<string | null>(
    authState.sessionExpired ? 'Your session has expired. Please log in again.' : null
  )
  let submitting = $state(false)

  authState.sessionExpired = false

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    error = null
    submitting = true
    try {
      await login(email, password)
      await goto('/')
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Something went wrong, try again.'
    } finally {
      submitting = false
    }
  }
</script>

<PageHead title="Log in" />

<div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
  <Card class="w-full max-w-sm p-8">
    <h1 class="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Bookkeeper</h1>
    <form onsubmit={handleSubmit} class="flex flex-col gap-4">
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
        <input
          type="email"
          bind:value={email}
          autocomplete="email"
          required
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
        <input
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      {#if error}
        <ErrorMessage message={error} class="" />
      {/if}
      <PrimaryButton type="submit" size="lg" disabled={submitting} class="mt-2">
        {submitting ? 'Signing in…' : 'Sign in'}
      </PrimaryButton>
    </form>
  </Card>
</div>
