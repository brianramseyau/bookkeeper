<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'
  import { formatCurrency, monthShortName } from '$lib/format'
  import { niceMax } from '$lib/chart-utils'

  interface MonthlyExpense {
    year: number
    month: number
    total: number
  }

  interface Props {
    data: MonthlyExpense[]
    /**
     * The series colour - normally the item's own identity colour (its
     * category, or an owner for subscriptions), so the chart matches the dot
     * in the stat row above it. Omit/null when the item has no such colour,
     * and the neutral series accent below is used instead.
     */
    color?: string | null
    onSelectMonth?: (year: number, month: number) => void
    ariaLabel?: string
  }

  let {
    data,
    color = null,
    onSelectMonth,
    ariaLabel = 'Monthly expenses over the last 12 months',
  }: Props = $props()

  let showTable = $state(false)
  let hoverIndex = $state<number | null>(null)

  // Polymer tokens (see DESIGN.md → Colour): the grid is the rule colour and
  // the axis text is muted. The series carries the item's identity colour
  // when it has one, so the chart ties to the dot in the stat row; with no
  // colour to inherit it falls back to a neutral series accent - the
  // unassigned $10-note blue, the one banknote hue with no fixed meaning.
  // Money figures (the latest-value label, the tooltip) stay plain ink.
  const RING_COLOR = $derived(themeState.current === 'dark' ? '#18201C' : '#ffffff')
  const GRID_COLOR = $derived(themeState.current === 'dark' ? '#27322C' : '#DAE1DC')
  const AXIS_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#93A299' : '#5C6A63')
  const VALUE_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#E5ECE8' : '#16201B')
  const NEUTRAL_SERIES_COLOR = { light: '#0E6FA8', dark: '#4FA6D9' }
  const SERIES_COLOR = $derived(
    color ??
      (themeState.current === 'dark' ? NEUTRAL_SERIES_COLOR.dark : NEUTRAL_SERIES_COLOR.light)
  )

  const width = 720
  const height = 240
  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 28
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const scale = $derived.by(() => {
    const maxValue = Math.max(...data.map((d) => d.total), 0)
    return niceMax(maxValue)
  })

  const points = $derived.by(() => {
    if (data.length === 0) return []
    const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0
    return data.map((entry, index) => ({
      x: padLeft + index * stepX,
      y: padTop + plotHeight - (entry.total / scale.max) * plotHeight,
      entry,
    }))
  })

  const linePath = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' '))
  const areaPath = $derived(
    points.length > 0
      ? `${linePath} L${points[points.length - 1]!.x},${padTop + plotHeight} L${points[0]!.x},${padTop + plotHeight} Z`
      : ''
  )

  const gridLines = $derived.by(() => {
    const lines: { y: number; value: number }[] = []
    for (let i = 0; i <= 4; i++) {
      const value = (scale.max / 4) * i
      lines.push({ y: padTop + plotHeight - (value / scale.max) * plotHeight, value })
    }
    return lines
  })

  const last = $derived(points[points.length - 1])
  const hovered = $derived(hoverIndex !== null ? points[hoverIndex] : null)

  function handlePointerMove(event: PointerEvent, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect()
    const scaleX = width / rect.width
    const localX = (event.clientX - rect.left) * scaleX
    if (points.length === 0) return
    let nearest = 0
    let nearestDist = Infinity
    for (const [i, p] of points.entries()) {
      const dist = Math.abs(p.x - localX)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = i
      }
    }
    hoverIndex = nearest
  }

  function handleClick() {
    if (hovered) onSelectMonth?.(hovered.entry.year, hovered.entry.month)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (points.length === 0) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      hoverIndex = hoverIndex === null ? 0 : Math.min(hoverIndex + 1, points.length - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      hoverIndex = hoverIndex === null ? points.length - 1 : Math.max(hoverIndex - 1, 0)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (hovered) onSelectMonth?.(hovered.entry.year, hovered.entry.month)
    }
  }
</script>

<div class="relative">
  {#if points.length > 0}
    <svg
      viewBox="0 0 {width} {height}"
      class={['w-full touch-none', onSelectMonth && 'cursor-pointer']}
      role="button"
      tabindex={onSelectMonth ? 0 : -1}
      aria-label="{ariaLabel}{onSelectMonth
        ? ' - use arrow keys to pick a month, Enter to open it in Monthly'
        : ''}"
      onpointermove={(e) => handlePointerMove(e, e.currentTarget)}
      onpointerleave={() => (hoverIndex = null)}
      onclick={handleClick}
      onkeydown={handleKeydown}
    >
      {#each gridLines as line (line.value)}
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={line.y}
          y2={line.y}
          stroke={GRID_COLOR}
          stroke-width="1"
        />
        <text
          x={padLeft - 8}
          y={line.y + 4}
          text-anchor="end"
          font-size="11"
          fill={AXIS_TEXT_COLOR}
        >
          {formatCurrency(line.value).replace('.00', '')}
        </text>
      {/each}

      {#each points as p (p.entry.year + '-' + p.entry.month)}
        <text x={p.x} y={height - 8} text-anchor="middle" font-size="11" fill={AXIS_TEXT_COLOR}>
          {monthShortName(p.entry.month)}
        </text>
      {/each}

      <path d={areaPath} fill={SERIES_COLOR} opacity="0.1" />
      <path
        d={linePath}
        fill="none"
        stroke={SERIES_COLOR}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      {#if last}
        <circle
          cx={last.x}
          cy={last.y}
          r="4"
          fill={SERIES_COLOR}
          stroke={RING_COLOR}
          stroke-width="2"
        />
        <text
          x={last.x}
          y={last.y - 10}
          text-anchor="end"
          font-size="12"
          font-weight="600"
          fill={VALUE_TEXT_COLOR}
        >
          {formatCurrency(last.entry.total)}
        </text>
      {/if}

      {#if hovered}
        <line
          x1={hovered.x}
          x2={hovered.x}
          y1={padTop}
          y2={padTop + plotHeight}
          stroke={AXIS_TEXT_COLOR}
          stroke-width="1"
          stroke-dasharray="3,3"
        />
        <circle
          cx={hovered.x}
          cy={hovered.y}
          r="4"
          fill={SERIES_COLOR}
          stroke={RING_COLOR}
          stroke-width="2"
        />
      {/if}
    </svg>

    {#if hovered}
      {@const left = (hovered.x / width) * 100}
      <div
        class="border-border bg-popover pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border px-2 py-1 text-xs shadow-sm"
        style="left: {left}%"
      >
        <p class="text-ink font-semibold">
          {formatCurrency(hovered.entry.total)}
        </p>
        <p class="text-muted-ink">
          {monthShortName(hovered.entry.month)}
          {hovered.entry.year}
        </p>
      </div>
    {/if}
  {:else}
    <p class="text-muted-ink py-8 text-center text-sm">Not enough data yet</p>
  {/if}
</div>

<button
  type="button"
  onclick={() => (showTable = !showTable)}
  class="text-muted-ink hover:text-violet mt-2 text-xs font-medium"
>
  {showTable ? 'Hide table' : 'View as table'}
</button>

{#if showTable}
  <div class="overflow-x-auto">
    <table class="mt-2 w-full border-collapse text-sm">
      <thead>
        <tr class="border-border border-b">
          <th class="text-muted-ink px-2 py-1 text-left font-semibold">Month</th>
          <th class="text-muted-ink px-2 py-1 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody>
        {#each data as entry (entry.year + '-' + entry.month)}
          <tr
            class={[
              'border-rule border-b last:border-0',
              onSelectMonth && 'hover:bg-accent cursor-pointer',
            ]}
            onclick={() => onSelectMonth?.(entry.year, entry.month)}
          >
            <td class="text-ink px-2 py-1">
              {monthShortName(entry.month)}
              {entry.year}
            </td>
            <td class="text-ink px-2 py-1 text-right">
              {formatCurrency(entry.total)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
