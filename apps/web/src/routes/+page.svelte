<script lang="ts">
  import { onMount } from 'svelte'
  import { goto, replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import { authState } from '$lib/stores/auth.svelte'
  import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
  import { formatCurrency, formatDaysUntilDue, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'
  import MonthlyExpenseChart from '$lib/components/MonthlyExpenseChart.svelte'
  import CategoryBreakdownList from '$lib/components/CategoryBreakdownList.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const yearParam = Number(page.url.searchParams.get('year'))
  const monthParam = Number(page.url.searchParams.get('month'))
  const hasValidMonthParam = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12

  let year = $state(Number.isInteger(yearParam) && yearParam > 0 ? yearParam : currentYear)
  let month = $state(hasValidMonthParam ? monthParam : currentMonth)
  let data = $state<DashboardSummary | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  const isCurrentMonth = $derived(year === currentYear && month === currentMonth)

  async function load() {
    loading = true
    try {
      data = await getDashboardSummary(year, month)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load dashboard'
    } finally {
      loading = false
    }
  }

  function setUrlParams(y: number, m: number) {
    replaceState(`/?year=${y}&month=${m}`, {})
  }

  function clearUrlParams() {
    if (page.url.search) {
      replaceState('/', {})
    }
  }

  function changeMonth(delta: number) {
    let newMonth = month + delta
    let newYear = year
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    } else if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    month = newMonth
    year = newYear
    setUrlParams(year, month)
    void load()
  }

  function goToCurrentMonth() {
    year = currentYear
    month = currentMonth
    clearUrlParams()
    void load()
  }

  onMount(load)
</script>

<PageHead title="Dashboard" />

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
    Welcome, {authState.user?.fullName ?? authState.user?.email}
  </h1>
  <div class="flex items-center gap-3">
    <button
      type="button"
      onclick={goToCurrentMonth}
      disabled={isCurrentMonth}
      aria-hidden={isCurrentMonth}
      tabindex={isCurrentMonth ? -1 : 0}
      class={[
        'rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50',
        isCurrentMonth && 'invisible',
      ]}
    >
      This Month
    </button>
    <button
      type="button"
      onclick={() => changeMonth(-1)}
      class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      ← Prev
    </button>
    <span class="w-36 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
      {monthName(month)}
      {year}
    </span>
    <button
      type="button"
      onclick={() => changeMonth(1)}
      class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Next →
    </button>
  </div>
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
        Monthly expenses (12 months through {monthName(month)}
        {year})
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
