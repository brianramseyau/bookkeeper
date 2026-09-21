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
  import PieChart from '$lib/components/PieChart.svelte'
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

  // A shared positive/negative/zero read for the "Right now" stat cards
  // below - `> 0`/`< 0`, not `>= 0`, so an exact on-plan/break-even month
  // gets its own neutral tone/wording instead of silently reading as a
  // "+" gain or a surplus/ahead-of-plan claim it didn't actually make.
  type Sign = 'positive' | 'negative' | 'zero'
  function signOf(value: number): Sign {
    return value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero'
  }
  function toneForSign(sign: Sign): 'positive' | 'negative' | 'default' {
    return sign === 'zero' ? 'default' : sign
  }

  // "vs projected": how far this month's actual net has drifted from the
  // standard-month projection - ahead of plan is good news, behind is worth
  // a glance. Tone is sign-based (`positive`/`negative`), the same
  // convention "Position" and "Income vs expenses" use below - `due` (a
  // due-*date* status, paired with a clock icon) doesn't fit a plan
  // deviation that isn't a date at all.
  const vsProjected = $derived(
    data ? round2(data.currentMonth.actualNet - data.currentMonth.projectedNet) : 0
  )
  const vsProjectedSign = $derived(signOf(vsProjected))

  // `categoryBreakdown` (unlike the 12-month `monthlyExpenses` trend the
  // Over time chart below deliberately uses) includes recurring bills and
  // subscriptions, which `monthlyExpenses` omits entirely (see
  // `DashboardController#monthlyExpenses`) - summing `monthlyExpenses`
  // here instead would silently miss whole categories of spend and could
  // disagree with "Position" for more than just the carryover it already
  // accounts for. `monthlyIncome`'s per-month entries are already scoped
  // to one month each, so no equivalent swap is needed there.
  //
  // `categoryBreakdown` is still not a *complete* month total, though -
  // `DashboardController#categoryBreakdown` silently drops any expense,
  // recurring bill or subscription with no category set (nullable
  // everywhere it's stored), and a due-but-unpaid recurring bill counts
  // at its committed amount rather than what's actually left the account.
  // Fixing that is a backend change, out of scope for this frontend-only
  // phase - the hint below is worded "categorised" rather than an
  // unqualified "this month" so the card doesn't claim more precision
  // than it has, which is also why this is deliberately not a "savings
  // rate" or anything else implying per-transaction knowledge of where
  // the money went. Distinct from "Position" above, which is the API's
  // `actualNet` and additionally folds in the carried-over balance from
  // prior months.
  const currentMonthTotals = $derived.by(() => {
    if (!data) return { income: 0, expense: 0 }
    const { year, month } = data.currentMonth
    const income = data.monthlyIncome.find((m) => m.year === year && m.month === month)?.total ?? 0
    const expense = data.categoryBreakdown.reduce((sum, c) => sum + c.total, 0)
    return { income, expense }
  })
  const monthlyPosition = $derived(round2(currentMonthTotals.income - currentMonthTotals.expense))
  const monthlyPositionSign = $derived(signOf(monthlyPosition))

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

  // 12-month totals for the donut. Both sides use the same trailing window
  // as the trend chart above it (`totalIncome` and `monthlyExpenses`).
  const expenseTotal = $derived(
    data ? round2(data.monthlyExpenses.reduce((sum, m) => sum + m.total, 0)) : 0
  )
  const incomeTotal = $derived(round2(data?.totalIncome ?? 0))
  const yearPosition = $derived(round2(incomeTotal - expenseTotal))
  const incomeVsExpensePie = $derived.by(() => {
    const slices: { label: string; value: number; color: string }[] = []
    if (incomeTotal > 0) slices.push({ label: 'Income', value: incomeTotal, color: INCOME_COLOR })
    if (expenseTotal > 0)
      slices.push({ label: 'Expenses', value: expenseTotal, color: EXPENSE_COLOR })
    return slices
  })
</script>

{#snippet positionCenter()}
  <span class={['font-figures text-lg font-semibold', yearPosition >= 0 ? 'text-in' : 'text-over']}>
    {formatCurrency(yearPosition)}
  </span>
  <span class="text-muted-foreground text-xs">{yearPosition >= 0 ? 'Surplus' : 'Deficit'}</span>
{/snippet}

{#snippet rightNow(d: DashboardSummary)}
  <section aria-labelledby="right-now-heading">
    <h2 id="right-now-heading" class="text-ink font-display text-lg">Right now</h2>
    <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Position"
        value={formatCurrency(d.currentMonth.actualNet)}
        tone={toneForSign(signOf(d.currentMonth.actualNet))}
        hint="Actual net this month"
      />
      <StatCard
        label="vs projected"
        value={`${vsProjectedSign === 'positive' ? '+' : ''}${formatCurrency(vsProjected)}`}
        tone={toneForSign(vsProjectedSign)}
        hint={vsProjectedSign === 'positive'
          ? 'Ahead of the standard-month plan'
          : vsProjectedSign === 'negative'
            ? 'Behind the standard-month plan'
            : 'Exactly on the standard-month plan'}
      />
      <StatCard
        label="Income vs expenses"
        value={formatCurrency(monthlyPosition)}
        tone={toneForSign(monthlyPositionSign)}
        hint={monthlyPositionSign === 'positive'
          ? 'Surplus vs categorised spend this month'
          : monthlyPositionSign === 'negative'
            ? 'Deficit vs categorised spend this month'
            : 'Breaking even vs categorised spend this month'}
      />
    </div>
    <div class="mt-4">
      {@render details(d)}
    </div>
  </section>
{/snippet}

{#snippet details(d: DashboardSummary)}
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Card class="p-4">
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

    <Card class="p-4">
      <h3 class="text-foreground text-sm font-semibold">
        {monthName(d.currentMonth.month)} spend by category
      </h3>
      <div class="mt-3">
        <CategoryBreakdownList data={d.categoryBreakdown} />
      </div>
    </Card>
  </div>
{/snippet}

{#snippet overTime()}
  <section aria-labelledby="over-time-heading">
    <h2 id="over-time-heading" class="text-ink font-display text-lg">Over time</h2>
    <div class="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card class="p-4">
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
      <Card class="p-4">
        <h3 class="text-foreground text-sm font-semibold">Income vs expenses (12 months)</h3>
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
  <div class="mt-6 flex flex-col gap-8">
    {@render rightNow(data)}
    {@render overTime()}
  </div>
{/if}
