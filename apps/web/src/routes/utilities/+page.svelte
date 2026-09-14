<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listUtilities,
    getUtilityTrend,
    createUtility,
    type Utility,
    type UtilityTrend,
  } from '$lib/api/utilities'
  import { daysUntil, formatCurrency, formatDate, formatDaysUntilDue, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import MonthlyExpenseChart from '$lib/components/MonthlyExpenseChart.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import { Button } from '$lib/components/ui/button'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'

  interface Row {
    utility: Utility
    trend: UtilityTrend | null
  }

  const DUE_SOON_WINDOW_DAYS = 30

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
  // whole page to a "Loading…" placeholder, which unmounts the panels and
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
  <div class="mt-6 flex flex-col gap-4">
    {#each rows as row (row.utility.id)}
      {@const trend = row.trend}
      <Card class="p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {row.utility.name}
            </h2>
            <p class="mt-0.5 text-xs text-slate-500 capitalize dark:text-slate-400">
              {row.utility.frequency}{row.utility.paidInAdvance ? ' · paid in advance' : ''}
            </p>
          </div>
          <a
            href={`/utilities/${row.utility.id}`}
            class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            View details →
          </a>
        </div>

        {#if trend && trend.latestAmount !== null}
          <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p class="text-xs text-slate-400 dark:text-slate-500">Latest bill</p>
              <p class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(trend.latestAmount)}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {monthName(trend.latestMonth ?? 0)}
                {trend.latestYear}
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-400 dark:text-slate-500">12-mo average</p>
              <p class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(trend.average)}
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-400 dark:text-slate-500">Trend</p>
              <p class="mt-1 text-xl font-semibold">
                <TrendIndicator trend={trend.trend} suffix=" on average" />
              </p>
            </div>
            <div>
              <p class="text-xs text-slate-400 dark:text-slate-500">Next bill due</p>
              {#if trend.nextDueOn}
                {@const days = daysUntil(trend.nextDueOn)}
                {@const dueSoon = days <= DUE_SOON_WINDOW_DAYS}
                <p class="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatDate(trend.nextDueOn)}
                </p>
                <span
                  class={[
                    'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                    dueSoon
                      ? days < 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400',
                  ]}
                >
                  {formatDaysUntilDue(days)}
                </span>
              {:else}
                <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">No due date set</p>
              {/if}
            </div>
          </div>

          <div class="mt-6">
            <MonthlyExpenseChart
              data={trend.months.map((m) => ({ year: m.year, month: m.month, total: m.amount }))}
              ariaLabel={`${row.utility.name} monthly amounts over the last 12 months`}
            />
          </div>
        {:else}
          <p class="mt-4 text-sm text-slate-400 dark:text-slate-500">No bills recorded yet</p>
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
    <Button type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add utility'}
    </Button>
  </form>
{/if}
