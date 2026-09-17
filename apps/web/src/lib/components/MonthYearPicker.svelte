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
  // Resolved once per open (in `toggle`, before the panel mounts) and shared
  // by `portal` and `position` below - see the comment on
  // `containingBlockAncestor` for why, and why it must not be re-derived
  // independently by each of them.
  let containingBlock: HTMLElement | null = null

  // "Current" is today's month/year, shown as a ring in the grid so the user
  // has their bearings when scrolling back to log a historical entry.
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const PANEL_WIDTH = 224 // matches w-56
  const VIEWPORT_MARGIN = 8
  const GAP = 4 // matches mt-1

  // `position: fixed` resolves against the nearest ancestor that establishes
  // a containing block for it - a `transform` (or its `translate`/`rotate`/
  // `scale` longhands - already in use elsewhere in this app, e.g.
  // `MonthStrip.svelte`/`IncomeExpenseBarChart.svelte`), `perspective`,
  // `filter`, `backdrop-filter`, a `will-change` naming any of those, a
  // `container-type` of `size`/`inline-size`, or `contain: layout` (or
  // `paint`/`strict`/`content`) - which is exactly what the shadcn Sheet's
  // content wrapper sets. Left alone, opening this picker from inside a
  // Sheet (e.g. ExpenseActualFormSheet) would resolve `left`/`top` against
  // the Sheet's own box instead of the viewport, landing the panel
  // off-screen - and a Sheet/Dialog also traps focus and locks the
  // background (`pointer-events: none` on `<body>`, re-enabled only on its
  // own modal content), so even a correctly-positioned panel portalled
  // straight to `document.body` would sit outside that trap: clicks pass
  // through it, and any focus this component moves there gets yanked
  // straight back by the Sheet's own trap guard the instant it lands
  // outside the Sheet's subtree - a plain competing `.focus()` call cannot
  // win that fight. So this walks up from the trigger for the nearest such
  // ancestor and, when one exists, portals *into* it instead of
  // `document.body` - back inside whatever trap it runs, so this
  // component's own focus management (below) actually holds - and
  // `position()` resolves `left`/`top` against that ancestor's own rect
  // rather than always assuming the viewport. With no such ancestor (the
  // common case), this is exactly the `document.body` portal every other
  // floating element in the app (Popover, DropdownMenu, AlertDialog)
  // already uses.
  function findContainingBlockAncestor(el: HTMLElement): HTMLElement | null {
    let node = el.parentElement
    while (node && node !== document.body) {
      const style = getComputedStyle(node)
      const willChangeList = style.willChange.split(',').map((value) => value.trim())
      if (
        style.transform !== 'none' ||
        style.translate !== 'none' ||
        style.rotate !== 'none' ||
        style.scale !== 'none' ||
        style.perspective !== 'none' ||
        style.filter !== 'none' ||
        style.backdropFilter !== 'none' ||
        /^(size|inline-size)$/.test(style.containerType) ||
        /(layout|paint|strict|content)/.test(style.contain) ||
        willChangeList.some((value) =>
          [
            'transform',
            'translate',
            'rotate',
            'scale',
            'perspective',
            'filter',
            'backdrop-filter',
            'contain',
          ].includes(value)
        )
      ) {
        return node
      }
      node = node.parentElement
    }
    return null
  }

  // A portalled-out element also needs its own `pointer-events-auto`
  // (applied at the call site below) to escape the ambient lock described
  // above. Reads the ancestor `toggle` resolved on open, rather than
  // re-deriving it - see `containingBlock`'s own comment.
  function portal(node: HTMLElement) {
    const target = containingBlock ?? document.body
    target.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  // The panel is fixed-positioned so an `overflow-x-auto` table card can't
  // clip it, and flips to open above the trigger when there's no room below
  // - the same viewport-aware pattern as HelpTooltip. `bounds` is normally
  // the viewport, but becomes `containingBlock`'s own rect when `portal`
  // above placed the panel inside one instead of `document.body`, since
  // that ancestor - not the viewport - is what `left`/`top` actually
  // resolve against in that case. This runs on every `resize`/`scroll`
  // while open, so it deliberately reuses `containingBlock` rather than
  // re-walking the ancestor chain per frame.
  function position() {
    if (!triggerEl || !panelEl) return
    const bounds = containingBlock
      ? containingBlock.getBoundingClientRect()
      : new DOMRect(0, 0, window.innerWidth, window.innerHeight)
    const triggerRect = triggerEl.getBoundingClientRect()
    const panelHeight = panelEl.getBoundingClientRect().height

    const triggerLeft = triggerRect.left - bounds.left
    const triggerTop = triggerRect.top - bounds.top
    const triggerBottom = triggerRect.bottom - bounds.top

    let left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(triggerLeft, bounds.width - PANEL_WIDTH - VIEWPORT_MARGIN)
    )

    const below = triggerBottom + GAP + panelHeight
    const above = triggerTop - GAP - panelHeight
    const fitsBelow = below <= bounds.height - VIEWPORT_MARGIN
    const fitsAbove = above >= VIEWPORT_MARGIN
    const top = fitsBelow || !fitsAbove ? triggerBottom + GAP : above

    panelStyle = `left: ${left}px; top: ${top}px; width: ${PANEL_WIDTH}px;`
  }

  // Once the panel is portalled inside the same trap the trigger's own
  // Sheet/Dialog runs (or, with no such ancestor, is simply next to a
  // trigger with no trap to fight), moving focus in explicitly and
  // trapping Tab here - same as `position` above, this only matters once
  // there's an ancestor trap to stay inside of, but doing it
  // unconditionally costs nothing when there isn't one.
  function focusInitial() {
    const selected = panelEl?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    ;(selected ?? panelEl?.querySelector<HTMLButtonElement>('button'))?.focus()
  }

  function close() {
    open = false
    containingBlock = null
    triggerEl?.focus()
  }

  function onPanelKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Also stop propagation - left alone, this keydown bubbles past the
      // panel to whatever Sheet/Dialog it's portalled inside of (see
      // `portal` above), which has its own Escape-to-close handler and
      // would otherwise close the whole Sheet, not just this popover.
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key !== 'Tab' || !panelEl) return
    const focusable = Array.from(panelEl.querySelectorAll<HTMLButtonElement>('button'))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  $effect(() => {
    if (!open) return
    position()
    focusInitial()
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
    if (!open) {
      viewYear = value ? Number(value.slice(0, 4)) : new Date().getFullYear()
      // Resolved here, before `open` flips and the panel mounts (and its
      // `use:portal` actions run) - see `containingBlock`'s own comment.
      containingBlock = triggerEl ? findContainingBlockAncestor(triggerEl) : null
    }
    open = !open
  }

  function pick(month: number) {
    const next = `${viewYear}-${String(month).padStart(2, '0')}`
    // Re-clicking the already-selected month clears the field.
    value = next === value ? '' : next
    onchange?.(value)
    close()
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
      use:portal
      type="button"
      class="pointer-events-auto fixed inset-0 z-50 cursor-default"
      aria-label="Close month picker"
      onclick={close}
    ></button>
    <div
      use:portal
      bind:this={panelEl}
      role="dialog"
      aria-label="Choose month"
      tabindex="-1"
      style={panelStyle}
      onkeydown={onPanelKeydown}
      class="border-border bg-popover pointer-events-auto fixed z-50 w-56 rounded-md border p-2 shadow-lg"
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
