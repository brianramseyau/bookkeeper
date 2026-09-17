<script lang="ts">
  import { mdiChevronDown } from '@mdi/js'
  import { monthShortName, monthYearLabel } from '$lib/format'

  const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  interface Props {
    /** Current value as "YYYY-MM", or '' for none. */
    value?: string
    /** 'form' (standard form-panel input) or 'table' (compact table-row input). */
    size?: 'form' | 'table'
    onchange?: (value: string) => void
    class?: string
    /** Applied to the trigger button, so an external `<label for>` can target it. */
    id?: string
  }

  let {
    value = $bindable(''),
    size = 'form',
    onchange,
    class: className = '',
    id,
  }: Props = $props()

  let open = $state(false)
  let viewYear = $state(new Date().getFullYear())
  let triggerEl = $state<HTMLButtonElement | undefined>()
  let panelEl = $state<HTMLDivElement | undefined>()
  let panelStyle = $state('')

  // "Current" is today's month/year, shown as a ring in the grid so the user
  // has their bearings when scrolling back to log a historical entry.
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const PANEL_WIDTH = 224 // matches w-56
  const VIEWPORT_MARGIN = 8
  const GAP = 4 // matches mt-1

  // The panel is fixed-positioned against the viewport (so an `overflow-x-auto`
  // table card can't clip it) and flipped to open above the trigger when
  // there's no room below - the same viewport-aware pattern as HelpTooltip.
  function position() {
    if (!triggerEl || !panelEl) return
    const triggerRect = triggerEl.getBoundingClientRect()
    const panelHeight = panelEl.getBoundingClientRect().height

    let left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(triggerRect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN)
    )

    const below = triggerRect.bottom + GAP + panelHeight
    const above = triggerRect.top - GAP - panelHeight
    const fitsBelow = below <= window.innerHeight - VIEWPORT_MARGIN
    const fitsAbove = above >= VIEWPORT_MARGIN
    const top = fitsBelow || !fitsAbove ? triggerRect.bottom + GAP : above

    panelStyle = `left: ${left}px; top: ${top}px; width: ${PANEL_WIDTH}px;`
  }

  $effect(() => {
    if (!open) return
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  })

  const selectedYear = $derived(value ? Number(value.slice(0, 4)) : null)
  const selectedMonth = $derived(value ? Number(value.slice(5, 7)) : null)
  const displayLabel = $derived(
    value ? monthYearLabel(Number(value.slice(0, 4)), Number(value.slice(5, 7))) : 'Select month'
  )

  const TRIGGER = {
    form: 'border-input w-40 rounded-md border bg-transparent px-2 py-1.5 text-sm',
    table: 'border-input w-32 rounded-md border bg-transparent px-2 py-1 text-sm',
  }

  function toggle() {
    if (!open) viewYear = value ? Number(value.slice(0, 4)) : new Date().getFullYear()
    open = !open
  }

  function pick(month: number) {
    const next = `${viewYear}-${String(month).padStart(2, '0')}`
    // Re-clicking the already-selected month clears the field.
    value = next === value ? '' : next
    onchange?.(value)
    open = false
  }
</script>

<div class="relative inline-block {className}">
  <button
    bind:this={triggerEl}
    {id}
    type="button"
    onclick={toggle}
    aria-haspopup="dialog"
    aria-expanded={open}
    class={[
      TRIGGER[size],
      'flex items-center justify-between gap-2 text-left',
      value ? 'text-foreground' : 'text-muted-foreground',
    ]}
  >
    <span>{displayLabel}</span>
    <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d={mdiChevronDown} />
    </svg>
  </button>

  {#if open}
    <button
      type="button"
      class="fixed inset-0 z-10 cursor-default"
      aria-label="Close month picker"
      onclick={() => (open = false)}
    ></button>
    <div
      bind:this={panelEl}
      role="dialog"
      aria-label="Choose month"
      style={panelStyle}
      class="border-border bg-popover fixed z-20 w-56 rounded-md border p-2 shadow-lg"
    >
      <div class="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          onclick={() => viewYear--}
          class="border-border text-muted-foreground hover:bg-accent rounded-md border px-2 py-0.5 text-sm"
        >
          ←
        </button>
        <span class="text-foreground text-sm font-medium">{viewYear}</span>
        <button
          type="button"
          aria-label="Next year"
          onclick={() => viewYear++}
          class="border-border text-muted-foreground hover:bg-accent rounded-md border px-2 py-0.5 text-sm"
        >
          →
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1">
        {#each MONTHS as month (month)}
          {@const selected = viewYear === selectedYear && month === selectedMonth}
          {@const isCurrent = viewYear === currentYear && month === currentMonth}
          <button
            type="button"
            onclick={() => pick(month)}
            aria-pressed={selected}
            class={[
              'rounded-md px-1 py-1.5 text-sm transition-colors',
              selected ? 'bg-accent text-primary font-medium' : 'text-foreground hover:bg-accent',
              isCurrent && 'ring-primary/40 ring-1 ring-inset',
            ]}
          >
            {monthShortName(month)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
