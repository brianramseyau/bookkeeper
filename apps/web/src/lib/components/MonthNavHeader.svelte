<script lang="ts">
  import type { MonthNav } from '$lib/month-nav.svelte'
  import { monthName } from '$lib/format'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    nav: MonthNav
    /** Hide the "Month Year" label - for a page that already shows it
        elsewhere (e.g. Monthly's `MonthStrip` headline), so it isn't
        repeated right next to this control. */
    showLabel?: boolean
  }

  let { nav, showLabel = true }: Props = $props()
</script>

<div class="flex items-center gap-3">
  <Button
    type="button"
    variant="secondary"
    onclick={() => nav.goToCurrentMonth()}
    disabled={nav.isCurrentMonth}
    aria-hidden={nav.isCurrentMonth}
    tabindex={nav.isCurrentMonth ? -1 : 0}
    class={nav.isCurrentMonth ? 'invisible' : undefined}
  >
    This Month
  </Button>
  <Button type="button" variant="outline" onclick={() => nav.changeMonth(-1)}>← Prev</Button>
  {#if showLabel}
    <span class="text-ink w-36 text-center text-sm font-medium">
      {monthName(nav.month)}
      {nav.year}
    </span>
  {/if}
  <Button type="button" variant="outline" onclick={() => nav.changeMonth(1)}>Next →</Button>
</div>
