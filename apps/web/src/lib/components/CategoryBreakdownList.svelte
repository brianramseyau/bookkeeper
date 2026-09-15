<script lang="ts">
  import type { DashboardCategoryBreakdown } from '$lib/api/dashboard'
  import { formatCurrency } from '$lib/format'

  interface Props {
    data: DashboardCategoryBreakdown[]
  }

  let { data }: Props = $props()

  const maxTotal = $derived(Math.max(...data.map((entry) => entry.total), 0))
</script>

{#if data.length === 0}
  <p class="text-muted-foreground py-8 text-center text-sm">No spend recorded yet</p>
{:else}
  <ul class="space-y-3">
    {#each data as entry (entry.id)}
      <li>
        <div class="flex items-center justify-between text-sm">
          <span class="text-foreground font-medium">{entry.name}</span>
          <span class="font-figures text-foreground font-semibold"
            >{formatCurrency(entry.total)}</span
          >
        </div>
        <div class="bg-muted mt-1 h-2 rounded-full">
          <div
            class="h-2 rounded-full"
            style="width: {maxTotal > 0
              ? (entry.total / maxTotal) * 100
              : 0}%; background-color: {entry.color ?? '#94a3b8'}"
          ></div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
