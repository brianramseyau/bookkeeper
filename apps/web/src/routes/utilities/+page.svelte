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

<svelte:head>
  <title>Utilities · Bookkeeper</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Utilities</h1>

{#if error}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else}
  <div class="mt-6 grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
    {#each rows as row (row.utility.id)}
      <a
        href={`/utilities/${row.utility.id}`}
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-600"
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
          {#if row.trend.trend === 'up'}
            <p class="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
              ▲ up on trailing average
            </p>
          {:else if row.trend.trend === 'down'}
            <p class="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ▼ down on trailing average
            </p>
          {:else if row.trend.trend === 'flat'}
            <p class="mt-2 text-sm font-medium text-slate-400 dark:text-slate-500">— flat</p>
          {/if}
        {:else}
          <p class="mt-2 text-sm text-slate-400 dark:text-slate-500">No bills recorded yet</p>
        {/if}
      </a>
    {/each}
  </div>

  <form onsubmit={handleAdd} class="mt-6 flex gap-2">
    <input
      type="text"
      placeholder="Add a utility (e.g. Internet)"
      bind:value={newUtilityName}
      class="max-w-xs flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    <button
      type="submit"
      disabled={creating}
      class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {creating ? 'Adding…' : 'Add utility'}
    </button>
  </form>
{/if}
