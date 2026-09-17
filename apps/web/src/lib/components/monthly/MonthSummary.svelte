<script lang="ts">
  import type { StandardMonthResult } from '$lib/api/standard-month'
  import { formatCurrency } from '$lib/format'

  interface Props {
    data: StandardMonthResult
  }

  let { data }: Props = $props()
</script>

<div class="border-rule mt-6 flex divide-x divide-solid overflow-hidden rounded-[10px] border">
  <div class="min-w-0 flex-1 px-3 py-2">
    <p class="text-muted-foreground text-xs">Income</p>
    <p class="font-figures text-in truncate text-lg font-semibold">
      {formatCurrency(data.income.actualTotal)}
    </p>
  </div>
  <div class="divide-rule min-w-0 flex-1 px-3 py-2">
    <p class="text-muted-foreground text-xs">Outgoing</p>
    <p class="font-figures text-ink truncate text-lg font-semibold">
      {formatCurrency(data.expenses.actualTotal)}
    </p>
  </div>
  <div class="divide-rule bg-in-tint min-w-0 flex-1 px-3 py-2">
    <p class="text-muted-foreground text-xs">Net</p>
    <p
      class="font-figures truncate text-lg font-semibold {data.actualNet >= 0
        ? 'text-in'
        : 'text-over'}"
    >
      {data.actualNet >= 0 ? '+' : ''}{formatCurrency(data.actualNet)}
    </p>
  </div>
</div>
