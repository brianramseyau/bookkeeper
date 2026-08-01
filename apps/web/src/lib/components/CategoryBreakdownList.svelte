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
  <p class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No spend recorded yet</p>
{:else}
  <ul class="space-y-3">
    {#each data as entry (entry.id)}
      <li>
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">{entry.name}</span>
          <span class="font-semibold text-slate-900 dark:text-slate-100"
            >{formatCurrency(entry.total)}</span
          >
        </div>
        <div class="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700/60">
          <div
            class="h-2 rounded-full"
            style="width: {maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0}%; background-color: {entry.color ??
              '#94a3b8'}"
          ></div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
