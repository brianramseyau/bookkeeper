<script lang="ts">
  import { goto } from '$app/navigation'
  import { login } from '$lib/stores/auth.svelte'
  import { ApiError } from '$lib/api'

  let email = $state('')
  let password = $state('')
  let error = $state<string | null>(null)
  let submitting = $state(false)

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

<div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
  <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
    <h1 class="mb-6 text-xl font-semibold text-slate-900">Bookkeeper</h1>
    <form onsubmit={handleSubmit} class="flex flex-col gap-4">
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          bind:value={email}
          autocomplete="email"
          required
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </label>
      {#if error}
        <p class="text-sm text-red-600">{error}</p>
      {/if}
      <button
        type="submit"
        disabled={submitting}
        class="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </div>
</div>
