<script lang="ts">
  import { page } from '$app/state'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'

  const notFound = $derived(page.status === 404)
</script>

<svelte:head>
  <title>{notFound ? 'Page not found' : 'Error'} · Bookkeeper</title>
</svelte:head>

<div class="mt-16 flex flex-col items-center gap-3 text-center">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
    {notFound ? 'Page not found' : `Something went wrong (${page.status})`}
  </h1>
  <p class="max-w-sm text-sm text-slate-500 dark:text-slate-400">
    {notFound
      ? "The page you're looking for doesn't exist or has moved."
      : (page.error?.message ?? 'An unexpected error occurred.')}
  </p>
  <PrimaryButton href="/" class="mt-2">Back to Dashboard</PrimaryButton>
</div>
