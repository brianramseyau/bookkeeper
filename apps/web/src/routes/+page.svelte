<script lang="ts">
  import { onMount } from 'svelte'
  import { authState } from '$lib/stores/auth.svelte'
  import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
  import { formatCurrency, formatDaysUntilDue, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Sparkline from '$lib/components/Sparkline.svelte'
  import MonthlyExpenseChart from '$lib/components/MonthlyExpenseChart.svelte'

  let data = $state<DashboardSummary | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      data = await getDashboardSummary()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load dashboard'
    } finally {
      loading = false
    }
  })
</script>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
  Welcome, {authState.user?.fullName ?? authState.user?.email}
</h1>

{#if error}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else if data}
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
    </div>
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
        href="/month"
        class="mt-1 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        View standard month →
      </a>
    </div>
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
    </div>
  </div>

  <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-800"
    >
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Monthly expenses (last 12 months)
      </h2>
      <div class="mt-3">
        <MonthlyExpenseChart data={data.monthlyExpenses} />
      </div>
    </div>

    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
      <h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming bills</h2>
      {#if data.upcomingBills.length === 0}
        <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Nothing scheduled.</p>
      {:else}
        <ul class="mt-3 divide-y divide-slate-100 dark:divide-slate-700/60">
          {#each data.upcomingBills as bill (bill.id)}
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
        href="/recurring-bills"
        class="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        View all recurring bills →
      </a>
    </div>
  </div>

  {#if data.utilities.length > 0}
    <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Utilities</h2>
    <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.utilities as utility (utility.id)}
        <a
          href="/utilities/{utility.id}"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-indigo-700"
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{utility.name}</p>
            <Sparkline values={utility.sparkline} trend={utility.trend} />
          </div>
          <p class="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(utility.latestAmount)}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            12-mo avg: {formatCurrency(utility.average)}
          </p>
        </a>
      {/each}
    </div>
  {/if}
{/if}
