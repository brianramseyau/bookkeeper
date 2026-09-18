<script lang="ts">
  import type { MonthNav } from '$lib/month-nav.svelte'
  import { monthName } from '$lib/format'
  import { Button } from '$lib/components/ui/button'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
  import { cn } from '$lib/utils'

  interface Props {
    nav: MonthNav
    /** Hide the "Month Year" label - for a page that already shows it
        elsewhere, so it isn't repeated right next to this control. Ignored
        by the `compact` variant, whose whole point is showing the label. */
    showLabel?: boolean
    /** `buttons` (default): "This Month" / "← Prev" / "Next →" text
        buttons - used by the Dashboard. `compact`: chevron icon buttons
        flanking the "Month Year" label, which doubles as the page's month
        heading and, tapped, jumps back to the current month - used by
        Monthly (see DESIGN.md's Monthly's unified list pattern). */
    variant?: 'buttons' | 'compact'
  }

  let { nav, showLabel = true, variant = 'buttons' }: Props = $props()
</script>

{#if variant === 'compact'}
  <div class="flex w-full items-center gap-2">
    <IconActionButton
      variant="neutral"
      label="Previous month"
      path={mdiChevronLeft}
      onclick={() => nav.changeMonth(-1)}
    />
    <h2 class="min-w-0 flex-1 text-center text-lg sm:text-2xl">
      <button
        type="button"
        onclick={() => nav.goToCurrentMonth()}
        disabled={nav.isCurrentMonth}
        title={nav.isCurrentMonth ? undefined : 'Jump to current month'}
        class={cn(
          'font-figures text-ink w-full truncate rounded-md',
          !nav.isCurrentMonth && 'hover:text-primary transition-colors'
        )}
      >
        {monthName(nav.month)}
        {nav.year}
      </button>
    </h2>
    <IconActionButton
      variant="neutral"
      label="Next month"
      path={mdiChevronRight}
      onclick={() => nav.changeMonth(1)}
    />
  </div>
{:else}
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
      <span class="text-ink w-36 text-center text-xs font-medium sm:text-sm">
        {monthName(nav.month)}
        {nav.year}
      </span>
    {/if}
    <Button type="button" variant="outline" onclick={() => nav.changeMonth(1)}>Next →</Button>
  </div>
{/if}
