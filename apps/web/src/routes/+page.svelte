<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authState } from '$lib/stores/auth.svelte'
  import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
  import { formatCurrency, formatDaysUntilDue, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'
  import { MonthNav } from '$lib/month-nav.svelte'
  import MonthNavHeader from '$lib/components/MonthNavHeader.svelte'
  import MonthlyExpenseChart from '$lib/components/MonthlyExpenseChart.svelte'
  import CategoryBreakdownList from '$lib/components/CategoryBreakdownList.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'

  const nav = new MonthNav('/', () => void load())
  let data = $state<DashboardSummary | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Only shows the full-page loading state on the very first load - once
  // there's data on screen, changing month should re-fetch quietly rather
  // than tearing the whole dashboard down to a spinner and back.
  async function load() {
    if (!data) loading = true
    try {
      data = await getDashboardSummary(nav.year, nav.month)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load dashboard'
    } finally {
      loading = false
    }
  }

  onMount(load)
</script>

<PageHead title="Dashboard" />

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
    Welcome, {authState.user?.fullName ?? authState.user?.email}
  </h1>
  <MonthNavHeader {nav} />
</div>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else if data}
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <Card class="p-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
        {monthName(data.currentMonth.month)} projected net
      </p>
      <p
        class={[
          'mt-1 text-2xl font-semibold',
          data.currentMonth.projectedNet >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400',
        ]}
      >
        {formatCurrency(data.currentMonth.projectedNet)}
      </p>
    </Card>
    <Card class="p-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Actual net so far</p>
      <p
        class={[
          'mt-1 text-2xl font-semibold',
          data.currentMonth.actualNet >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400',
        ]}
      >
        {formatCurrency(data.currentMonth.actualNet)}
      </p>
      <a
        href="/monthly"
        class="mt-1 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        View monthly →
      </a>
    </Card>
    <Card class="p-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Next bill due</p>
      {#if data.upcomingBills.length > 0}
        {@const next = data.upcomingBills[0]!}
        <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(next.amount)}
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {next.name} · {formatDaysUntilDue(next.daysUntilDue)}
        </p>
      {:else}
        <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">Nothing scheduled</p>
      {/if}
    </Card>
  </div>

  <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
    <Card class="p-4 lg:col-span-2">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Monthly expenses (12 months through {monthName(nav.month)}
        {nav.year})
      </h2>
      <div class="mt-3">
        <MonthlyExpenseChart
          data={data.monthlyExpenses}
          onSelectMonth={(year, month) => goto(`/monthly?year=${year}&month=${month}`)}
        />
      </div>
    </Card>

    <Card class="p-4">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming bills</h2>
      {#if data.upcomingBills.length === 0}
        <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Nothing scheduled.</p>
      {:else if data.upcomingBills.length === 1}
        <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Nothing else scheduled.</p>
      {:else}
        <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-700/60">
          {#each data.upcomingBills.slice(1) as bill (bill.id)}
            <li class="flex items-center justify-between py-2 text-sm">
              <div>
                <p class="font-medium text-slate-900 dark:text-slate-100">{bill.name}</p>
                <p
                  class={[
                    'text-xs',
                    bill.daysUntilDue !== null && bill.daysUntilDue < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400',
                  ]}
                >
                  {formatDaysUntilDue(bill.daysUntilDue)}
                </p>
              </div>
              <span class="font-medium text-slate-900 dark:text-slate-100"
                >{formatCurrency(bill.amount)}</span
              >
            </li>
          {/each}
        </ul>
      {/if}
      <a
        href="/bills"
        class="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        View all recurring bills →
      </a>
    </Card>

    <Card class="p-4 lg:col-span-2">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {monthName(data.currentMonth.month)} spend by category
      </h2>
      <div class="mt-3">
        <CategoryBreakdownList data={data.categoryBreakdown} />
      </div>
    </Card>
  </div>
{/if}
