<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listUtilities,
    getUtilityTrend,
    createUtility,
    type Utility,
    type UtilityTrend,
  } from '$lib/api/utilities'
  import { formatCurrency, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'

  interface Row {
    utility: Utility
    trend: UtilityTrend | null
  }

  let rows = $state<Row[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let newUtilityName = $state('')
  let creating = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      await refresh()
    } finally {
      loading = false
    }
  }

  // Re-fetches without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the table and
  // resets scroll position when adding a utility.
  async function refresh() {
    try {
      const utilities = await listUtilities()
      const trends = await Promise.all(utilities.map((u) => getUtilityTrend(u.id)))
      rows = utilities.map((utility, i) => ({ utility, trend: trends[i] ?? null }))
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load utilities'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!newUtilityName.trim()) return
    creating = true
    error = null
    try {
      await createUtility(newUtilityName.trim())
      newUtilityName = ''
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add utility'
    } finally {
      creating = false
    }
  }
</script>

<PageHead title="Utilities" />

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Utilities</h1>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else}
  <div class="mt-6 grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
    {#each rows as row (row.utility.id)}
      <Card
        href={`/utilities/${row.utility.id}`}
        class="p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-600"
      >
        <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {row.utility.name}
        </h2>
        {#if row.trend && row.trend.latestAmount !== null}
          <p class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(row.trend.latestAmount)}
            <span class="text-sm font-normal text-slate-400 dark:text-slate-500">
              {monthName(row.trend.latestMonth ?? 0)}
              {row.trend.latestYear}
            </span>
          </p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            12-mo avg: {formatCurrency(row.trend.average)}
          </p>
          <TrendIndicator
            trend={row.trend.trend}
            suffix=" on trailing average"
            class="mt-2 text-sm font-medium"
            as="p"
          />
        {:else}
          <p class="mt-2 text-sm text-slate-400 dark:text-slate-500">No bills recorded yet</p>
        {/if}
      </Card>
    {/each}
  </div>

  <form onsubmit={handleAdd} class="mt-6 flex gap-2">
    <input
      type="text"
      placeholder="Add a utility (e.g. Internet)"
      bind:value={newUtilityName}
      class="max-w-xs flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    <PrimaryButton type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add utility'}
    </PrimaryButton>
  </form>
{/if}
