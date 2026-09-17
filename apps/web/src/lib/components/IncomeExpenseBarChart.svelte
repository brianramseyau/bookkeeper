<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'
  import { formatCurrency, monthShortName } from '$lib/format'
  import { niceMax } from '$lib/chart-utils'

  export interface IncomeExpenseMonth {
    year: number
    month: number
    income: number
    expense: number
  }

  interface Props {
    data: IncomeExpenseMonth[]
    // Passed in by the caller rather than owned here, so this chart always
    // matches the donut's income/expense colours (DESIGN.md → Colour: `in`
    // for income, `over` for expenses) instead of picking its own.
    incomeColor: string
    expenseColor: string
    onSelectMonth?: (year: number, month: number) => void
    ariaLabel?: string
  }

  let {
    data,
    incomeColor,
    expenseColor,
    onSelectMonth,
    ariaLabel = 'Income vs expenses by month',
  }: Props = $props()

  // Polymer neutrals shared by every chart in this set (DESIGN.md → Colour):
  // grid is the rule colour, axis text is muted - only the bars themselves
  // carry the income/expense colours passed in above.
  const GRID_COLOR = $derived(themeState.current === 'dark' ? '#27322C' : '#DAE1DC')
  const AXIS_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#93A299' : '#5C6A63')
  const HIGHLIGHT_COLOR = $derived(themeState.current === 'dark' ? '#E5ECE8' : '#16201B')

  let showTable = $state(false)
  let hoverIndex = $state<number | null>(null)

  const width = 720
  const height = 240
  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 28
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom
  const baseline = padTop + plotHeight

  // Mark spec (dataviz skill): bars cap at 24px thick and never fill the
  // slot; a 2px surface gap separates the income/expense pair, matching the
  // gap left between adjacent month groups.
  const GAP = 2
  const MAX_BAR_WIDTH = 24
  const RADIUS = 4

  const scale = $derived.by(() => {
    const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expense]), 0)
    return niceMax(maxValue)
  })

  const slotWidth = $derived(data.length > 0 ? plotWidth / data.length : 0)
  const barWidth = $derived(
    slotWidth > 0 ? Math.max(0, Math.min(MAX_BAR_WIDTH, (slotWidth - GAP * 3) / 2)) : 0
  )

  function yFor(value: number): number {
    return baseline - (value / scale.max) * plotHeight
  }

  const groups = $derived.by(() => {
    if (data.length === 0) return []
    const pairWidth = barWidth * 2 + GAP
    return data.map((entry, index) => {
      const slotX = padLeft + index * slotWidth
      const groupX = slotX + (slotWidth - pairWidth) / 2
      const incomeY = yFor(entry.income)
      const expenseY = yFor(entry.expense)
      return {
        entry,
        slotX,
        centerX: slotX + slotWidth / 2,
        incomeX: groupX,
        incomeY,
        incomeHeight: baseline - incomeY,
        expenseX: groupX + barWidth + GAP,
        expenseY,
        expenseHeight: baseline - expenseY,
      }
    })
  })

  const gridLines = $derived.by(() => {
    const lines: { y: number; value: number }[] = []
    for (let i = 0; i <= 4; i++) {
      const value = (scale.max / 4) * i
      lines.push({ y: baseline - (value / scale.max) * plotHeight, value })
    }
    return lines
  })

  // A rectangle path with rounded top corners, square at the baseline - the
  // mark spec calls for the data-end rounded and the base square, never a
  // fully rounded rect sitting on the axis.
  function roundedTopBar(x: number, y: number, w: number, h: number): string {
    if (h <= 0 || w <= 0) return ''
    const r = Math.min(RADIUS, w / 2, h)
    return `M${x},${baseline} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${baseline} Z`
  }

  const hovered = $derived(hoverIndex !== null ? groups[hoverIndex] : null)

  function handlePointerMove(event: PointerEvent, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect()
    const scaleX = width / rect.width
    const localX = (event.clientX - rect.left) * scaleX
    if (groups.length === 0) return
    let nearest = 0
    let nearestDist = Infinity
    for (const [i, g] of groups.entries()) {
      const dist = Math.abs(g.centerX - localX)
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
    if (groups.length === 0) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      hoverIndex = hoverIndex === null ? 0 : Math.min(hoverIndex + 1, groups.length - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      hoverIndex = hoverIndex === null ? groups.length - 1 : Math.max(hoverIndex - 1, 0)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (hovered) onSelectMonth?.(hovered.entry.year, hovered.entry.month)
    }
  }
</script>

<div class="relative">
  {#if groups.length > 0}
    <div class="text-muted-foreground mb-2 flex items-center gap-4 text-xs">
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-sm" style="background: {incomeColor}"></span>
        Income
      </span>
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-sm" style="background: {expenseColor}"></span>
        Expenses
      </span>
    </div>

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

      {#if hovered}
        <rect
          x={hovered.slotX}
          y={padTop}
          width={slotWidth}
          height={plotHeight}
          fill={HIGHLIGHT_COLOR}
          opacity="0.06"
        />
      {/if}

      {#each groups as group (group.entry.year + '-' + group.entry.month)}
        <path d={roundedTopBar(group.incomeX, group.incomeY, barWidth, group.incomeHeight)} fill={incomeColor} />
        <path
          d={roundedTopBar(group.expenseX, group.expenseY, barWidth, group.expenseHeight)}
          fill={expenseColor}
        />
        <text x={group.centerX} y={height - 8} text-anchor="middle" font-size="11" fill={AXIS_TEXT_COLOR}>
          {monthShortName(group.entry.month)}
        </text>
      {/each}
    </svg>

    {#if hovered}
      {@const left = (hovered.centerX / width) * 100}
      <div
        class="border-border bg-popover pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-sm"
        style="left: {left}%"
      >
        <p class="text-muted-ink font-semibold">
          {monthShortName(hovered.entry.month)}
          {hovered.entry.year}
        </p>
        <p class="flex items-center gap-1.5">
          <span class="size-2 rounded-sm" style="background: {incomeColor}"></span>
          <span class="text-ink">{formatCurrency(hovered.entry.income)}</span>
        </p>
        <p class="flex items-center gap-1.5">
          <span class="size-2 rounded-sm" style="background: {expenseColor}"></span>
          <span class="text-ink">{formatCurrency(hovered.entry.expense)}</span>
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
          <th class="text-muted-ink px-2 py-1 text-right font-semibold">Income</th>
          <th class="text-muted-ink px-2 py-1 text-right font-semibold">Expenses</th>
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
              {formatCurrency(entry.income)}
            </td>
            <td class="text-ink px-2 py-1 text-right">
              {formatCurrency(entry.expense)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
