<script lang="ts">
  import type { StandardMonthResult } from '$lib/api/standard-month'
  import { formatCurrency } from '$lib/format'

  interface Props {
    data: StandardMonthResult
  }

  let { data }: Props = $props()

  // Income minus Outgoing (not `data.actualNet`, which also folds in the
  // carried-over balance) - so this cell reconciles visually with its two
  // siblings rather than differing by exactly the carryover, which is
  // already shown on its own in CarryoverCard right below.
  const net = $derived(data.income.actualTotal - data.expenses.actualTotal)
</script>

<div
  class="border-rule divide-rule mt-6 flex divide-x divide-solid overflow-hidden rounded-[10px] border"
>
  <div class="min-w-0 flex-1 px-3 py-2">
    <p class="text-muted-foreground text-xs">Income</p>
    <p class="font-figures text-in truncate text-lg font-semibold">
      {formatCurrency(data.income.actualTotal)}
    </p>
  </div>
  <div class="min-w-0 flex-1 px-3 py-2">
    <p class="text-muted-foreground text-xs">Outgoing</p>
    <p class="font-figures text-ink truncate text-lg font-semibold">
      {formatCurrency(data.expenses.actualTotal)}
    </p>
  </div>
  <div class="min-w-0 flex-1 px-3 py-2 {net >= 0 ? 'bg-in-tint' : 'bg-over-tint'}">
    <p class="text-muted-foreground text-xs">Net</p>
    <p class="font-figures truncate text-lg font-semibold {net >= 0 ? 'text-in' : 'text-over'}">
      {net >= 0 ? '+' : ''}{formatCurrency(net)}
    </p>
  </div>
</div>
