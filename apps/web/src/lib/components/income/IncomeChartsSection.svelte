<script lang="ts">
  import type { UserSummary } from '$lib/api/users'
  import {
    getIncomeYtd,
    listIncomeEntries,
    type IncomeEntry,
    type IncomeSource,
    type IncomeYtdMonth,
  } from '$lib/api/income'
  import { getIncomeTaxSetting } from '$lib/api/income_tax_settings'
  import { themeState } from '$lib/stores/theme.svelte'
  import { financialYearFor, financialYearLabel, round2 } from '$lib/format'
  import { buildYearlySeries } from '$lib/income-charts'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import PieChart, { type PieSlice } from '$lib/components/PieChart.svelte'
  import IncomeYtdChart from '$lib/components/IncomeYtdChart.svelte'
  import YearlyIncomeLineChart from '$lib/components/YearlyIncomeLineChart.svelte'
  import { mdiChevronDown } from '@mdi/js'

  interface Props {
    userId: number | null
    financialYear: number
    users: UserSummary[]
    /** Needed to attribute a source-tied entry to its owner (it carries no userId). */
    sources: IncomeSource[]
    /** Bump after an entry mutation so an open section refetches. */
    refreshToken?: number
  }

  let { userId, financialYear, users, sources, refreshToken = 0 }: Props = $props()

  // Both figures are money coming in, so neither gets a semantic colour -
  // they're distinguished by weight (ink vs muted). Money going out is ink
  // too, unless the item has an identity colour to carry (MonthlyExpenseChart's
  // optional `color` prop). See DESIGN.md → Colour.
  const CHART_COLORS = {
    salary: { light: '#16201B', dark: '#E5ECE8' },
    other: { light: '#5C6A63', dark: '#93A299' },
  }
  const PERSON_FALLBACK_COLORS = ['#f59e0b', '#10b981', '#ec4899', '#0ea5e9']

  let open = $state(false)
  let loading = $state(false)
  let error = $state<string | null>(null)
  let dataKey = $state('')
  let allEntries = $state<IncomeEntry[]>([])
  let ytdMonths = $state<IncomeYtdMonth[]>([])
  let taxRates = $state<Map<string, number | null>>(new Map())

  // Salary entries are already net take-home; other income nets through the
  // owner's marginal rate for its financial year, falling back to the gross
  // sale when tax was withheld at source or no rate is set.
  function netOf(entry: IncomeEntry): number {
    if (entry.incomeSourceId !== null || entry.taxWithheld) return entry.amount
    const rate =
      entry.userId === null
        ? null
        : (taxRates.get(`${entry.userId}:${financialYearFor(entry.year, entry.month)}`) ?? null)
    return rate === null ? entry.amount : round2(entry.amount - entry.amount * rate)
  }

  const sourceById = $derived(new Map(sources.map((s) => [s.id, s])))

  // A source-tied entry carries only `incomeSourceId`, so its owner comes
  // from the source; an unattributed one carries `userId` directly.
  function entryOwnerId(entry: IncomeEntry): number | null {
    if (entry.incomeSourceId !== null) {
      return sourceById.get(entry.incomeSourceId)?.userId ?? null
    }
    return entry.userId
  }

  const selectedYearEntries = $derived(
    allEntries.filter((e) => financialYearFor(e.year, e.month) === financialYear)
  )

  const selectedUserLabel = $derived(users.find((u) => u.id === userId)?.fullName ?? 'This person')

  const salaryColor = $derived(
    themeState.current === 'dark' ? CHART_COLORS.salary.dark : CHART_COLORS.salary.light
  )
  const otherColor = $derived(
    themeState.current === 'dark' ? CHART_COLORS.other.dark : CHART_COLORS.other.light
  )

  const salaryVsOtherPie = $derived.by(() => {
    let salary = 0
    let other = 0
    for (const entry of selectedYearEntries) {
      if (entry.incomeSourceId !== null) salary += entry.amount
      else other += netOf(entry)
    }
    const slices: PieSlice[] = []
    if (salary > 0) slices.push({ label: 'Salary', value: round2(salary), color: salaryColor })
    if (other > 0) slices.push({ label: 'Other income', value: round2(other), color: otherColor })
    return slices
  })

  const personPie = $derived.by(() => {
    const totals = new Map<number, number>()
    for (const entry of selectedYearEntries) {
      const owner = entryOwnerId(entry)
      if (owner === null) continue
      totals.set(owner, (totals.get(owner) ?? 0) + netOf(entry))
    }
    return users
      .filter((user) => (totals.get(user.id) ?? 0) > 0)
      .map((user, index) => ({
        label: user.fullName ?? user.email,
        value: round2(totals.get(user.id) ?? 0),
        color: user.displayColor ?? PERSON_FALLBACK_COLORS[index % PERSON_FALLBACK_COLORS.length],
      }))
  })

  const yearlySeries = $derived(buildYearlySeries(allEntries, netOf))

  const ytdChartData = $derived(
    ytdMonths.map((m) => ({
      year: m.year,
      month: m.month,
      actual: m.actual,
      projected: m.projected,
    }))
  )

  // Lazily fetched the first time the section is opened for a given (user,
  // financial year); reopening the same selection reuses what's loaded. A
  // `refreshToken` bump (an entry was logged/edited/deleted) forces a refetch
  // while the section is open.
  $effect(() => {
    if (!open || userId === null) return
    const key = `${userId}:${financialYear}:${refreshToken}`
    if (dataKey === key) return
    dataKey = key
    void load()
  })

  async function load() {
    loading = true
    error = null
    try {
      const [all, ytd] = await Promise.all([
        listIncomeEntries(),
        getIncomeYtd(userId ?? 0, financialYear),
      ])
      allEntries = all
      ytdMonths = ytd.months

      // Per-person marginal rates for every financial year present, so other
      // income can be netted per owner. Bounded: two users x the few years of
      // history the app holds.
      const fys = new Set<number>()
      for (const entry of all) fys.add(financialYearFor(entry.year, entry.month))
      const rates = new Map<string, number | null>()
      await Promise.all(
        users.flatMap((user) =>
          [...fys].map(async (fy) => {
            try {
              const setting = await getIncomeTaxSetting(user.id, fy)
              rates.set(`${user.id}:${fy}`, setting.marginalRate)
            } catch {
              rates.set(`${user.id}:${fy}`, null)
            }
          })
        )
      )
      taxRates = rates
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load charts'
    } finally {
      loading = false
    }
  }
</script>

<Card class="mt-3 p-4">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    class="flex w-full items-center justify-between gap-3 text-left"
  >
    <span>
      <span class="text-foreground block text-base font-semibold">Charts</span>
      <span class="text-muted-foreground block text-sm">
        Estimated vs actual, year-by-year income, and how income splits between people and sources
      </span>
    </span>
    <svg
      viewBox="0 0 24 24"
      class={['text-muted-foreground size-5 shrink-0 transition-transform', open && 'rotate-180']}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={mdiChevronDown} />
    </svg>
  </button>

  {#if open}
    <div class="mt-4">
      {#if loading && allEntries.length === 0}
        <LoadingSkeleton rows={4} />
      {:else if error}
        <ErrorMessage message={error} />
      {:else}
        <div class="grid gap-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <section class="border-border rounded-xl border p-4">
              <h3 class="text-foreground text-sm font-semibold">Income by person</h3>
              <p class="text-muted-foreground mt-0.5 text-xs">
                Net income by household member for {financialYearLabel(financialYear)}.
              </p>
              <div class="mt-3">
                <PieChart
                  data={personPie}
                  emptyMessage="No income logged this year"
                  centerLabel="Net income"
                />
              </div>
            </section>

            <section class="border-border rounded-xl border p-4">
              <h3 class="text-foreground text-sm font-semibold">Salary vs other income</h3>
              <p class="text-muted-foreground mt-0.5 text-xs">
                Net income by source type for {financialYearLabel(financialYear)}.
              </p>
              <div class="mt-3">
                <PieChart
                  data={salaryVsOtherPie}
                  emptyMessage="No income logged this year"
                  centerLabel="Net income"
                />
              </div>
            </section>
          </div>

          <section class="border-border rounded-xl border p-4">
            <h3 class="text-foreground text-sm font-semibold">Estimated vs actual income</h3>
            <p class="text-muted-foreground mt-0.5 text-xs">
              {selectedUserLabel} in {financialYearLabel(financialYear)}. Estimated is what sources
              should have paid so far; actual is what's been logged.
            </p>
            <div class="mt-3">
              <IncomeYtdChart data={ytdChartData} />
            </div>
          </section>

          <section class="border-border rounded-xl border p-4">
            <h3 class="text-foreground text-sm font-semibold">Year by year</h3>
            <p class="text-muted-foreground mt-0.5 text-xs">
              Cumulative net income for the household across each financial year.
            </p>
            <div class="mt-3">
              <YearlyIncomeLineChart series={yearlySeries} />
            </div>
          </section>
        </div>
      {/if}
    </div>
  {/if}
</Card>
