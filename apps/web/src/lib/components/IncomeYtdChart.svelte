<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'
  import { formatCurrency, monthShortName } from '$lib/format'
  import { niceMax } from '$lib/chart-utils'

  export interface YtdBar {
    year: number
    month: number
    actual: number
    projected: number
  }

  interface Props {
    data: YtdBar[]
    ariaLabel?: string
  }

  let { data, ariaLabel = 'Estimated vs actual income by month' }: Props = $props()

  // Polymer tokens (DESIGN.md → Colour): both series are money coming in, so
  // neither takes a semantic colour - actual reads as ink, estimated recedes
  // to muted, and the grid/axis use the rule/muted neutrals the other charts
  // already use.
  const ACTUAL_COLOR = $derived(themeState.current === 'dark' ? '#E5ECE8' : '#16201B')
  const PROJECTED_COLOR = $derived(themeState.current === 'dark' ? '#93A299' : '#5C6A63')
  const GRID_COLOR = $derived(themeState.current === 'dark' ? '#27322C' : '#DAE1DC')
  const AXIS_TEXT_COLOR = $derived(themeState.current === 'dark' ? '#93A299' : '#5C6A63')

  const width = 720
  const height = 240
  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 28
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const scale = $derived.by(() => {
    const maxValue = Math.max(...data.flatMap((d) => [d.actual, d.projected]), 0)
    return niceMax(maxValue)
  })

  const bars = $derived.by(() => {
    if (data.length === 0) return []
    const slotWidth = plotWidth / data.length
    const barWidth = slotWidth * 0.55
    return data.map((entry, index) => {
      const x = padLeft + index * slotWidth + (slotWidth - barWidth) / 2
      const yFor = (value: number) => padTop + plotHeight - (value / scale.max) * plotHeight
      const actualHeight = padTop + plotHeight - yFor(entry.actual)
      const projectedHeight = padTop + plotHeight - yFor(entry.projected)
      return {
        entry,
        x,
        barWidth,
        actualY: yFor(entry.actual),
        actualHeight,
        projectedY: yFor(entry.projected),
        projectedHeight,
      }
    })
  })

  const gridLines = $derived.by(() => {
    const lines: { y: number; value: number }[] = []
    for (let i = 0; i <= 4; i++) {
      const value = (scale.max / 4) * i
      lines.push({ y: padTop + plotHeight - (value / scale.max) * plotHeight, value })
    }
    return lines
  })
</script>

{#if bars.length > 0}
  <div class="text-muted-foreground mb-2 flex items-center gap-4 text-xs">
    <span class="flex items-center gap-1.5">
      <span class="size-2.5 rounded-sm" style="background: {ACTUAL_COLOR}"></span>
      Actual
    </span>
    <span class="flex items-center gap-1.5">
      <span class="size-2.5 rounded-sm" style="background: {PROJECTED_COLOR}"></span>
      Estimated
    </span>
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

    {#each bars as bar (bar.entry.year + '-' + bar.entry.month)}
      <rect
        x={bar.x}
        y={bar.projectedY}
        width={bar.barWidth}
        height={bar.projectedHeight}
        fill={PROJECTED_COLOR}
        rx="2"
      />
      <rect
        x={bar.x}
        y={bar.actualY}
        width={bar.barWidth}
        height={bar.actualHeight}
        fill={ACTUAL_COLOR}
        rx="2"
      />
      <text
        x={bar.x + bar.barWidth / 2}
        y={height - 8}
        text-anchor="middle"
        font-size="11"
        fill={AXIS_TEXT_COLOR}
      >
        {monthShortName(bar.entry.month)}
      </text>
    {/each}
  </svg>
{:else}
  <p class="text-muted-foreground py-8 text-center text-sm">Not enough data yet</p>
{/if}
