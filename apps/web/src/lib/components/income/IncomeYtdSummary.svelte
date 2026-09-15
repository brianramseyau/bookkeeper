<script lang="ts">
  import { formatCurrency } from '$lib/format'

  interface Props {
    /** Net figures for the selected financial year - see the page's ytdSummary. */
    total: number
    salary: number
    other: number
  }

  let { total, salary, other }: Props = $props()
</script>

<dl
  class="border-rule bg-card divide-rule mt-4 grid grid-cols-3 divide-x overflow-hidden rounded-xl border"
>
  <div class="px-4 py-3">
    <dt class="text-muted-foreground text-xs font-medium">To date</dt>
    <dd class="font-figures text-in mt-0.5 text-xl font-semibold">{formatCurrency(total)}</dd>
  </div>
  <div class="px-4 py-3">
    <dt class="text-muted-foreground text-xs font-medium">Salary</dt>
    <dd class="font-figures text-foreground mt-0.5 text-xl">{formatCurrency(salary)}</dd>
  </div>
  <div class="px-4 py-3">
    <dt class="text-muted-foreground text-xs font-medium">Other</dt>
    <dd class="font-figures text-foreground mt-0.5 text-xl">{formatCurrency(other)}</dd>
  </div>
</dl>
