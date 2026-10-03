<script lang="ts">
  import type { StandardMonthResult } from '$lib/api/standard-month'
  import { formatCurrency } from '$lib/format'
  import SummaryStrip from '$lib/components/app/SummaryStrip.svelte'

  interface Props {
    data: StandardMonthResult
  }

  let { data }: Props = $props()

  // Income minus Outgoing (not `data.actualNet`, which also folds in the
  // carried-over balance) - so this cell reconciles visually with its two
  // siblings rather than differing by exactly the carryover, which is
  // already shown on its own in CarryoverCard right below.
  const net = $derived(data.income.actualTotal - data.expenses.actualTotal)

  const figures = $derived([
    {
      label: 'Income',
      value: formatCurrency(data.income.actualTotal),
      tone: 'in' as const,
      strong: true,
    },
    {
      label: 'Outgoing',
      value: formatCurrency(data.expenses.actualTotal),
      tone: 'default' as const,
      strong: true,
    },
    {
      label: 'Net',
      value: `${net >= 0 ? '+' : ''}${formatCurrency(net)}`,
      tone: net >= 0 ? ('in' as const) : ('over' as const),
      tint: net >= 0 ? ('in' as const) : ('over' as const),
      strong: true,
    },
  ])
</script>

<SummaryStrip class="mt-6" {figures} />
