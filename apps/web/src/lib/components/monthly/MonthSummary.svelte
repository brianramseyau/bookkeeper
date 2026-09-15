<script lang="ts">
  import type { StandardMonthResult } from '$lib/api/standard-month'
  import { formatCurrency } from '$lib/format'
  import MonthStrip from '$lib/components/app/MonthStrip.svelte'
  import StatGrid from '$lib/components/app/StatGrid.svelte'
  import StatCard from '$lib/components/app/StatCard.svelte'

  interface Props {
    year: number
    month: number
    data: StandardMonthResult
  }

  let { year, month, data }: Props = $props()
</script>

<div class="mt-6">
  <MonthStrip {year} {month} {data} />
</div>

<div class="mt-4">
  <StatGrid cols={3}>
    <StatCard
      label="Cash on hand"
      value={formatCurrency(data.carryover + data.income.actualTotal)}
      hint={`Carried over (${formatCurrency(data.carryover)}) plus actual income received so far (${formatCurrency(data.income.actualTotal)}), before this month's expenses.`}
    />
    <StatCard
      label="Actual net (so far)"
      value={formatCurrency(data.actualNet)}
      tone={data.actualNet >= 0 ? 'positive' : 'negative'}
      hint="Carried over plus actual income received, minus actual expenses paid so far."
    />
    <StatCard
      label="Variance"
      value={formatCurrency(data.actualNet - data.projectedNet)}
      tone={data.actualNet - data.projectedNet >= 0 ? 'positive' : 'negative'}
      hint="Actual net (so far) minus projected net."
    />
  </StatGrid>
</div>
