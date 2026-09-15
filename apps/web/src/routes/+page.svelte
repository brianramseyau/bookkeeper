<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authState } from '$lib/stores/auth.svelte'
  import { themeState } from '$lib/stores/theme.svelte'
  import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
  import { getStandardMonth, type StandardMonthResult } from '$lib/api/standard-month'
  import { formatCurrency, formatDaysUntilDue, monthName, round2 } from '$lib/format'
  import { ApiError } from '$lib/api'
  import { MonthNav } from '$lib/month-nav.svelte'
  import MonthNavHeader from '$lib/components/MonthNavHeader.svelte'
  import MonthStrip from '$lib/components/app/MonthStrip.svelte'
  import MonthlyExpenseChart from '$lib/components/MonthlyExpenseChart.svelte'
  import CategoryBreakdownList from '$lib/components/CategoryBreakdownList.svelte'
  import PieChart from '$lib/components/PieChart.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'

  const nav = new MonthNav('/', () => void load())
  let data = $state<DashboardSummary | null>(null)
  let standardMonth = $state<StandardMonthResult | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Only shows the full-page loading state on the very first load - once
  // there's data on screen, changing month should re-fetch quietly rather
  // than tearing the whole dashboard down to a spinner and back.
  async function load() {
    if (!data) loading = true
    error = null
    try {
      const [summary, month] = await Promise.all([
        getDashboardSummary(nav.year, nav.month),
        getStandardMonth(nav.year, nav.month),
      ])
      data = summary
      standardMonth = month
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load dashboard'
    } finally {
      loading = false
    }
  }

  onMount(load)

  // Money in / money out use the Polymer semantic colours (DESIGN.md →
  // Colour): `in` for income, `over` for expenses - the same meaning they
  // carry everywhere else, rather than a one-off chart palette.
  const INCOME_COLOR = $derived(themeState.current === 'dark' ? '#3FC79D' : '#0A6B50')
  const EXPENSE_COLOR = $derived(themeState.current === 'dark' ? '#F2735A' : '#9C3320')

  const expenseTotal = $derived(
    data ? data.monthlyExpenses.reduce((sum, m) => sum + m.total, 0) : 0
  )
  const incomeTotal = $derived(data?.totalIncome ?? 0)
  const position = $derived(round2(incomeTotal - expenseTotal))
  const positionIsPositive = $derived(position >= 0)

  const incomeVsExpensePie = $derived.by(() => {
    const slices: { label: string; value: number; color: string }[] = []
    if (incomeTotal > 0)
      slices.push({ label: 'Income', value: round2(incomeTotal), color: INCOME_COLOR })
    if (expenseTotal > 0)
      slices.push({ label: 'Expenses', value: round2(expenseTotal), color: EXPENSE_COLOR })
    return slices
  })
</script>

<PageHeader
  title="Welcome, {authState.user?.fullName ?? authState.user?.email ?? 'there'}"
  documentTitle="Dashboard"
>
  {#snippet actions()}
    <MonthNavHeader {nav} showLabel={false} />
  {/snippet}
</PageHeader>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <div class="mt-6">
    <LoadingSkeleton rows={5} />
  </div>
{:else if data && standardMonth}
  <div class="mt-6">
    <MonthStrip year={nav.year} month={nav.month} data={standardMonth} />
  </div>

  {#snippet positionCenter()}
    <span
      class={['font-figures text-lg font-semibold', positionIsPositive ? 'text-in' : 'text-over']}
    >
      {formatCurrency(position)}
    </span>
    <span class="text-muted-foreground text-xs">
      {positionIsPositive ? 'Surplus' : 'Deficit'}
    </span>
  {/snippet}

  <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
    <Card class="p-4 lg:col-span-2">
      <h2 class="text-foreground text-sm font-semibold">
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
      <h2 class="text-foreground text-sm font-semibold">Upcoming bills</h2>
      {#if data.upcomingBills.length === 0}
        <p class="text-muted-foreground mt-3 text-sm">Nothing scheduled.</p>
      {:else}
        <ul class="divide-rule mt-3 divide-y">
          {#each data.upcomingBills as bill (bill.id)}
            <li class="flex items-center justify-between gap-3 py-2 text-sm">
              <div class="min-w-0">
                <a href={`/bills/${bill.id}`} class="text-foreground hover:text-primary font-medium">
                  {bill.name}
                </a>
                <p
                  class={[
                    'text-xs',
                    bill.daysUntilDue !== null && bill.daysUntilDue < 0
                      ? 'text-over'
                      : 'text-muted-foreground',
                  ]}
                >
                  {formatDaysUntilDue(bill.daysUntilDue)}
                </p>
              </div>
              <span class="font-figures text-foreground shrink-0 font-medium"
                >{formatCurrency(bill.amount)}</span
              >
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <Card class="p-4 lg:col-span-2">
      <h2 class="text-foreground text-sm font-semibold">
        {monthName(data.currentMonth.month)} spend by category
      </h2>
      <div class="mt-3">
        <CategoryBreakdownList data={data.categoryBreakdown} />
      </div>
    </Card>

    <Card class="p-4">
      <h2 class="text-foreground text-sm font-semibold">Income vs expenses (12 months)</h2>
      <p class="text-muted-foreground mt-0.5 text-xs">
        Net income against logged spend through {monthName(nav.month)}
        {nav.year}
      </p>
      <div class="mt-3">
        <PieChart
          data={incomeVsExpensePie}
          emptyMessage="No income or expenses logged"
          center={positionCenter}
        />
      </div>
    </Card>
  </div>
{/if}
