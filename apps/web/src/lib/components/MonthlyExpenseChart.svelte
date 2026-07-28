<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'
  import { formatCurrency, monthShortName } from '$lib/format'

  interface MonthlyExpense {
    year: number
    month: number
    total: number
  }

  interface Props {
    data: MonthlyExpense[]
    onSelectMonth?: (year: number, month: number) => void
  }

  let { data, onSelectMonth }: Props = $props()

  let showTable = $state(false)
  let hoverIndex = $state<number | null>(null)

  const LINE_COLOR = $derived(themeState.current === 'dark' ? '#818cf8' : '#4f46e5')
  const RING_COLOR = $derived(themeState.current === 'dark' ? '#1e293b' : '#ffffff')
  const GRID_COLOR = $derived(themeState.current === 'dark' ? '#334155' : '#e2e8f0')
  const AXIS_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#94a3b8' : '#64748b')

  const width = 720
  const height = 240
  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 28
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  function niceMax(value: number): { max: number; step: number } {
    if (value <= 0) return { max: 100, step: 25 }
    const rough = value / 4
    const magnitude = 10 ** Math.floor(Math.log10(rough))
    const normalized = rough / magnitude
    const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
    return { max: step * 4, step }
  }

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
      aria-label="Monthly expenses over the last 12 months{onSelectMonth
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

      <path d={areaPath} fill={LINE_COLOR} opacity="0.1" />
      <path
        d={linePath}
        fill="none"
        stroke={LINE_COLOR}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      {#if last}
        <circle
          cx={last.x}
          cy={last.y}
          r="4"
          fill={LINE_COLOR}
          stroke={RING_COLOR}
          stroke-width="2"
        />
        <text
          x={last.x}
          y={last.y - 10}
          text-anchor="end"
          font-size="12"
          font-weight="600"
          fill={LINE_COLOR}
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
          fill={LINE_COLOR}
          stroke={RING_COLOR}
          stroke-width="2"
        />
      {/if}
    </svg>

    {#if hovered}
      {@const left = (hovered.x / width) * 100}
      <div
        class="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900"
        style="left: {left}%"
      >
        <p class="font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(hovered.entry.total)}
        </p>
        <p class="text-slate-500 dark:text-slate-400">
          {monthShortName(hovered.entry.month)}
          {hovered.entry.year}
        </p>
      </div>
    {/if}
  {:else}
    <p class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Not enough data yet</p>
  {/if}
</div>

<button
  type="button"
  onclick={() => (showTable = !showTable)}
  class="mt-2 text-xs font-medium text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
>
  {showTable ? 'Hide table' : 'View as table'}
</button>

{#if showTable}
  <div class="overflow-x-auto">
    <table class="mt-2 w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-2 py-1 text-left font-semibold text-slate-500 dark:text-slate-400">Month</th
          >
          <th class="px-2 py-1 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Total</th
          >
        </tr>
      </thead>
      <tbody>
        {#each data as entry (entry.year + '-' + entry.month)}
          <tr
            class={[
              'border-b border-slate-100 last:border-0 dark:border-slate-700/60',
              onSelectMonth && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40',
            ]}
            onclick={() => onSelectMonth?.(entry.year, entry.month)}
          >
            <td class="px-2 py-1 text-slate-700 dark:text-slate-300">
              {monthShortName(entry.month)}
              {entry.year}
            </td>
            <td class="px-2 py-1 text-right text-slate-900 dark:text-slate-100">
              {formatCurrency(entry.total)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
