<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'
  import { formatCurrency, monthShortName } from '$lib/format'
  import { niceMax } from '$lib/chart-utils'

  export interface YearLine {
    label: string
    color: string
    points: { month: number; total: number }[]
  }

  interface Props {
    series: YearLine[]
    ariaLabel?: string
  }

  let { series, ariaLabel = 'Cumulative income by financial year' }: Props = $props()

  const GRID_COLOR = $derived(themeState.current === 'dark' ? '#27322C' : '#DAE1DC')
  const AXIS_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#93A299' : '#5C6A63')
  const RING_COLOR = $derived(themeState.current === 'dark' ? '#18201C' : '#FFFFFF')

  const width = 720
  const height = 240
  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 28
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const MONTH_ORDER = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

  const scale = $derived.by(() => {
    const maxValue = Math.max(...series.flatMap((s) => s.points.map((p) => p.total)), 0)
    return niceMax(maxValue)
  })

  const xOf = $derived((month: number) => {
    const index = MONTH_ORDER.indexOf(month)
    return padLeft + (index / (MONTH_ORDER.length - 1)) * plotWidth
  })
  const yOf = $derived((value: number) => padTop + plotHeight - (value / scale.max) * plotHeight)

  const lines = $derived.by(() =>
    series.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p, x: xOf(p.month), y: yOf(p.total) })),
    }))
  )

  const gridLines = $derived.by(() => {
    const lines: { y: number; value: number }[] = []
    for (let i = 0; i <= 4; i++) {
      const value = (scale.max / 4) * i
      lines.push({ y: yOf(value), value })
    }
    return lines
  })
</script>

{#if lines.some((s) => s.points.length > 0)}
  <div
    class="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
  >
    {#each lines as line (line.label)}
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-full" style="background: {line.color}"></span>
        {line.label}
      </span>
    {/each}
  </div>

  <svg viewBox="0 0 {width} {height}" class="w-full" role="img" aria-label={ariaLabel}>
    {#each gridLines as line (line.value)}
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={line.y}
        y2={line.y}
        stroke={GRID_COLOR}
        stroke-width="1"
      />
      <text x={padLeft - 8} y={line.y + 4} text-anchor="end" font-size="11" fill={AXIS_TEXT_COLOR}>
        {formatCurrency(line.value).replace('.00', '')}
      </text>
    {/each}

    {#each MONTH_ORDER as month, index}
      <text
        x={padLeft + (index / (MONTH_ORDER.length - 1)) * plotWidth}
        y={height - 8}
        text-anchor="middle"
        font-size="11"
        fill={AXIS_TEXT_COLOR}
      >
        {monthShortName(month)}
      </text>
    {/each}

    {#each lines as line (line.label)}
      {#if line.points.length >= 2}
        <path
          d={line.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={line.color}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/if}
      {#each line.points as point, i (line.label + '-' + point.month)}
        {#if line.points.length === 1 || i === line.points.length - 1}
          <circle
            cx={point.x}
            cy={point.y}
            r={line.points.length === 1 ? 4 : 3}
            fill={line.color}
            stroke={RING_COLOR}
            stroke-width="2"
          />
        {/if}
      {/each}
    {/each}
  </svg>
{:else}
  <p class="text-muted-foreground py-8 text-center text-sm">Not enough data yet</p>
{/if}
