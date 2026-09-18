<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'
  import { formatCurrency, monthShortName } from '$lib/format'
  import { niceDomain } from '$lib/chart-utils'

  export interface IncomeExpenseMonth {
    year: number
    month: number
    income: number
    expense: number
  }

  interface Props {
    data: IncomeExpenseMonth[]
    // Passed in by the caller rather than owned here, so this chart always
    // matches the stat row's income/expense colours (DESIGN.md → Colour:
    // `in` for income, `over` for expenses) instead of picking its own.
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
    ariaLabel = 'Income, expenses and net position by month',
  }: Props = $props()

  // Polymer neutrals shared by every chart in this set (DESIGN.md → Colour):
  // grid is the rule colour, axis text is muted - only the bars carry the
  // income/expense colours passed in above. The net line is plain ink, like
  // MonthStrip's running-balance line was - a derived total, not a
  // semantic in/out value.
  const GRID_COLOR = $derived(themeState.current === 'dark' ? '#27322C' : '#DAE1DC')
  const AXIS_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#93A299' : '#5C6A63')
  const HIGHLIGHT_COLOR = $derived(themeState.current === 'dark' ? '#E5ECE8' : '#16201B')
  const NET_LINE_COLOR = $derived(themeState.current === 'dark' ? '#E5ECE8' : '#16201B')
  const RING_COLOR = $derived(themeState.current === 'dark' ? '#18201C' : '#ffffff')

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

  // Mark spec (dataviz skill): bars cap at 24px thick and never fill the
  // slot; a 2px surface gap separates the income/expense pair, matching the
  // gap left between adjacent month groups.
  const GAP = 2
  const MAX_BAR_WIDTH = 24
  const RADIUS = 4

  // The dashboard always passes a full 12-month window, even when every
  // month is zero (a fresh install, or no income/spend logged yet) - without
  // this check `groups` would never be empty and the placeholder below
  // could never show.
  const hasData = $derived(data.some((d) => d.income !== 0 || d.expense !== 0))

  const nets = $derived(data.map((d) => d.income - d.expense))

  // The bars only ever grow up from zero (income/expense are never
  // negative), but the net line can dip below it in a deficit month - the
  // y-domain has to cover both, so it's driven off every series at once
  // rather than niceMax's positive-only assumption.
  const scale = $derived.by(() => {
    const hi = Math.max(...data.flatMap((d) => [d.income, d.expense]), ...nets, 0)
    const lo = Math.min(...nets, 0)
    return niceDomain(lo, hi)
  })

  const slotWidth = $derived(data.length > 0 ? plotWidth / data.length : 0)
  const barWidth = $derived(
    slotWidth > 0 ? Math.max(0, Math.min(MAX_BAR_WIDTH, (slotWidth - GAP * 3) / 2)) : 0
  )

  function yFor(value: number): number {
    const span = scale.max - scale.min
    return padTop + plotHeight - ((value - scale.min) / span) * plotHeight
  }

  const zeroY = $derived(yFor(0))

  const groups = $derived.by(() => {
    if (data.length === 0) return []
    const pairWidth = barWidth * 2 + GAP
    return data.map((entry, index) => {
      const slotX = padLeft + index * slotWidth
      const groupX = slotX + (slotWidth - pairWidth) / 2
      const incomeY = yFor(entry.income)
      const expenseY = yFor(entry.expense)
      const net = entry.income - entry.expense
      return {
        entry,
        net,
        slotX,
        centerX: slotX + slotWidth / 2,
        incomeX: groupX,
        incomeY,
        incomeHeight: zeroY - incomeY,
        expenseX: groupX + barWidth + GAP,
        expenseY,
        expenseHeight: zeroY - expenseY,
        netX: slotX + slotWidth / 2,
        netY: yFor(net),
      }
    })
  })

  const netLinePath = $derived(
    groups.map((g, i) => `${i === 0 ? 'M' : 'L'}${g.netX},${g.netY}`).join(' ')
  )

  const gridLines = $derived.by(() => {
    const lines: { y: number; value: number }[] = []
    for (let value = scale.min; value <= scale.max + 0.01; value += scale.step) {
      lines.push({ y: yFor(value), value })
    }
    return lines
  })

  // A rectangle path with rounded top corners, square at the baseline - the
  // mark spec calls for the data-end rounded and the base square, never a
  // fully rounded rect sitting on the axis.
  function roundedTopBar(x: number, y: number, w: number, h: number): string {
    if (h <= 0 || w <= 0) return ''
    const r = Math.min(RADIUS, w / 2, h)
    return `M${x},${zeroY} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${zeroY} Z`
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

<div>
  {#if hasData}
    <div class="text-muted-foreground mb-2 flex items-center gap-4 text-xs">
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-sm" style="background: {incomeColor}"></span>
        Income
      </span>
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-sm" style="background: {expenseColor}"></span>
        Expenses
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-0.5 w-3 rounded-full" style="background: {NET_LINE_COLOR}"></span>
        Net
      </span>
    </div>

    <div class="relative">
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
          <path
            d={roundedTopBar(group.incomeX, group.incomeY, barWidth, group.incomeHeight)}
            fill={incomeColor}
          />
          <path
            d={roundedTopBar(group.expenseX, group.expenseY, barWidth, group.expenseHeight)}
            fill={expenseColor}
          />
          <text
            x={group.centerX}
            y={height - 8}
            text-anchor="middle"
            font-size="11"
            fill={AXIS_TEXT_COLOR}
          >
            {monthShortName(group.entry.month)}
          </text>
        {/each}

        <path
          d={netLinePath}
          fill="none"
          stroke={NET_LINE_COLOR}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        {#each groups as group (group.entry.year + '-' + group.entry.month + '-net')}
          <circle
            cx={group.netX}
            cy={group.netY}
            r={hovered === group ? 4 : 3}
            fill={NET_LINE_COLOR}
            stroke={RING_COLOR}
            stroke-width="2"
          />
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
          <p class="flex items-center gap-1.5">
            <span class="h-0.5 w-2 rounded-full" style="background: {NET_LINE_COLOR}"></span>
            <span class="text-ink">{formatCurrency(hovered.net)}</span>
          </p>
        </div>
      {/if}
    </div>
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
          <th class="text-muted-ink px-2 py-1 text-right font-semibold">Net</th>
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
            <td class="text-ink px-2 py-1 text-right">
              {formatCurrency(entry.income - entry.expense)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
