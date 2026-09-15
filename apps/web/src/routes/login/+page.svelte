<script lang="ts">
  import { goto } from '$app/navigation'
  import { authState, login } from '$lib/stores/auth.svelte'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'

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

<div class="bg-ground flex min-h-screen items-center justify-center px-4">
  <Card class="w-full max-w-sm p-8">
    <h1 class="font-display text-foreground mb-6 text-2xl">Bookkeeper</h1>
    <form onsubmit={handleSubmit} class="flex flex-col gap-4">
      <label class="flex flex-col gap-1">
        <span class="text-foreground text-sm font-medium">Email</span>
        <Input type="email" bind:value={email} autocomplete="email" required />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-foreground text-sm font-medium">Password</span>
        <Input type="password" bind:value={password} autocomplete="current-password" required />
      </label>
      {#if error}
        <ErrorMessage message={error} class="" />
      {/if}
      <Button type="submit" size="lg" disabled={submitting} class="mt-2">
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  </Card>
</div>
