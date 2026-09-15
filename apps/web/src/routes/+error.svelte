<script lang="ts">
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui/button'
  import LostPiggyIllustration from '$lib/components/LostPiggyIllustration.svelte'

  const notFound = $derived(page.status === 404)
</script>

<svelte:head>
  <title>{notFound ? 'Page not found' : 'Error'} · Bookkeeper</title>
</svelte:head>

<div class="mt-12 flex flex-col items-center gap-3 text-center">
  <LostPiggyIllustration class="h-40 w-40" />
  <h1 class="font-display text-foreground text-2xl">
    {notFound ? 'Page not found' : `Something went wrong (${page.status})`}
  </h1>
  <p class="text-muted-foreground max-w-sm text-sm">
    {notFound
      ? "The page you're looking for doesn't exist or has moved."
      : (page.error?.message ?? 'An unexpected error occurred.')}
  </p>
  <Button href="/" class="mt-2">Back to Dashboard</Button>
</div>
