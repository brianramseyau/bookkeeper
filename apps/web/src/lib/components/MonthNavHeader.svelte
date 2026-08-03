<script lang="ts">
  import type { MonthNav } from '$lib/month-nav.svelte'
  import { monthName } from '$lib/format'

  interface Props {
    nav: MonthNav
  }

  let { nav }: Props = $props()
</script>

<div class="flex items-center gap-3">
  <button
    type="button"
    onclick={() => nav.goToCurrentMonth()}
    disabled={nav.isCurrentMonth}
    aria-hidden={nav.isCurrentMonth}
    tabindex={nav.isCurrentMonth ? -1 : 0}
    class={[
      'rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50',
      nav.isCurrentMonth && 'invisible',
    ]}
  >
    This Month
  </button>
  <button
    type="button"
    onclick={() => nav.changeMonth(-1)}
    class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
  >
    ← Prev
  </button>
  <span class="w-36 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
    {monthName(nav.month)}
    {nav.year}
  </span>
  <button
    type="button"
    onclick={() => nav.changeMonth(1)}
    class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
  >
    Next →
  </button>
</div>
