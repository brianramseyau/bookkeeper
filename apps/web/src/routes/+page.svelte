<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authState } from '$lib/stores/auth.svelte'
  import { themeState } from '$lib/stores/theme.svelte'
  import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
  import { formatCurrency, formatDaysUntilDue, monthName, round2 } from '$lib/format'
  import { ApiError } from '$lib/api'
  import { MonthNav } from '$lib/month-nav.svelte'
  import MonthNavHeader from '$lib/components/MonthNavHeader.svelte'
  import StatCard from '$lib/components/app/StatCard.svelte'
  import NetPositionTrendChart from '$lib/components/NetPositionTrendChart.svelte'
  import CategoryBreakdownList from '$lib/components/CategoryBreakdownList.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'

  const nav = new MonthNav('/', () => void load())
  let data = $state<DashboardSummary | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  // Only shows the full-page loading state on the very first load - once
  // there's data on screen, changing month should re-fetch quietly rather
  // than tearing the whole dashboard down to a spinner and back.
  async function load() {
    if (!data) loading = true
    error = null
    try {
      data = await getDashboardSummary(nav.year, nav.month)
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

  // "vs projected": how far this month's actual net has drifted from the
  // standard-month projection - ahead of plan is good news, behind is worth
  // a glance (`due`, not `over` - it isn't wrong, just needs attention).
  const vsProjected = $derived(
    data ? round2(data.currentMonth.actualNet - data.currentMonth.projectedNet) : 0
  )
  const vsProjectedIsAhead = $derived(vsProjected >= 0)

  // `monthlyIncome`/`monthlyExpenses` are both a trailing 12-month window
  // (see `$lib/api/dashboard.ts`), so summing either whole array - like the
  // Over time chart deliberately does - gives a 12-month figure, not this
  // month's. Picking out the one entry matching `currentMonth` gives the
  // plain income-minus-expenses figure for the viewed month alone -
  // deliberately not a "savings rate" or anything else implying per-
  // transaction knowledge of where the money went, which this app doesn't
  // track. Also distinct from "Position" above, which is the API's
  // `actualNet` and folds in the carried-over balance from prior months.
  const currentMonthTotals = $derived.by(() => {
    if (!data) return { income: 0, expense: 0 }
    const { year, month } = data.currentMonth
    return {
      income: data.monthlyIncome.find((m) => m.year === year && m.month === month)?.total ?? 0,
      expense: data.monthlyExpenses.find((m) => m.year === year && m.month === month)?.total ?? 0,
    }
  })
  const monthlyPosition = $derived(round2(currentMonthTotals.income - currentMonthTotals.expense))
  const monthlyPositionIsPositive = $derived(monthlyPosition >= 0)

  // Joined by year/month key rather than array index - monthlyExpenses and
  // monthlyIncome both currently return the same 12-month window in the same
  // order, but a key join stays correct even if that alignment ever breaks
  // instead of silently pairing the wrong months.
  const incomeVsExpenseByMonth = $derived.by(() => {
    if (!data) return []
    const incomeByKey = new Map(data.monthlyIncome.map((m) => [`${m.year}-${m.month}`, m.total]))
    return data.monthlyExpenses.map((expenseMonth) => ({
      year: expenseMonth.year,
      month: expenseMonth.month,
      income: incomeByKey.get(`${expenseMonth.year}-${expenseMonth.month}`) ?? 0,
      expense: expenseMonth.total,
    }))
  })
</script>

{#snippet rightNow(d: DashboardSummary)}
  <section aria-labelledby="right-now-heading">
    <h2 id="right-now-heading" class="text-ink font-display text-lg">Right now</h2>
    <div class="mt-3">
      <!-- Below `lg` this zone spans the full page width, so 3 columns fit
           fine (matches StatGrid's own `cols=3`) - at `lg+` it narrows to
           2/5 of the page for the two-zone split, too tight for three
           currency values side by side, so it drops to a single column
           there instead of truncating them. -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <StatCard
          label="Position"
          value={formatCurrency(d.currentMonth.actualNet)}
          tone={d.currentMonth.actualNet >= 0 ? 'positive' : 'negative'}
          hint="Actual net this month"
        />
        <StatCard
          label="vs projected"
          value={`${vsProjectedIsAhead ? '+' : ''}${formatCurrency(vsProjected)}`}
          tone={vsProjectedIsAhead ? 'positive' : 'due'}
          hint={vsProjectedIsAhead
            ? 'Ahead of the standard-month plan'
            : 'Behind the standard-month plan'}
        />
        <StatCard
          label="Income vs expenses"
          value={formatCurrency(monthlyPosition)}
          tone={monthlyPositionIsPositive ? 'positive' : 'negative'}
          hint={monthlyPositionIsPositive ? 'Surplus this month' : 'Deficit this month'}
        />
      </div>
    </div>

    <Card class="mt-6 p-4">
      <h3 class="text-foreground text-sm font-semibold">Upcoming bills</h3>
      {#if d.upcomingBills.length === 0}
        <p class="text-muted-foreground mt-3 text-sm">Nothing scheduled.</p>
      {:else}
        <ul class="divide-rule mt-3 divide-y">
          {#each d.upcomingBills as bill (bill.id)}
            <li class="flex items-center justify-between gap-3 py-2 text-sm">
              <div class="min-w-0">
                <a
                  href={`/bills/${bill.id}`}
                  class="text-foreground hover:text-primary font-medium"
                >
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

    <Card class="mt-6 p-4">
      <h3 class="text-foreground text-sm font-semibold">
        {monthName(d.currentMonth.month)} spend by category
      </h3>
      <div class="mt-3">
        <CategoryBreakdownList data={d.categoryBreakdown} />
      </div>
    </Card>
  </section>
{/snippet}

{#snippet overTime()}
  <section aria-labelledby="over-time-heading">
    <h2 id="over-time-heading" class="text-ink font-display text-lg">Over time</h2>
    <Card class="mt-3 p-4">
      <h3 class="text-foreground text-sm font-semibold">
        Income, expenses and net position (12 months through {monthName(nav.month)}
        {nav.year})
      </h3>
      <div class="mt-3">
        <NetPositionTrendChart
          data={incomeVsExpenseByMonth}
          incomeColor={INCOME_COLOR}
          expenseColor={EXPENSE_COLOR}
          onSelectMonth={(year, month) => goto(`/monthly?year=${year}&month=${month}`)}
        />
      </div>
    </Card>
  </section>
{/snippet}

<PageHeader
  title="Welcome, {authState.user?.fullName ?? authState.user?.email ?? 'there'}"
  documentTitle="Dashboard"
/>

<div class="mt-3">
  <MonthNavHeader {nav} variant="compact" />
</div>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <div class="mt-6">
    <LoadingSkeleton rows={5} />
  </div>
{:else if data}
  <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-5">
    <div class="lg:col-span-2">
      {@render rightNow(data)}
    </div>
    <div class="lg:col-span-3">
      {@render overTime()}
    </div>
  </div>
{/if}
