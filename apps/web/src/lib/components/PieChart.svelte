<script lang="ts">
  import type { Snippet } from 'svelte'
  import { formatCurrency } from '$lib/format'

  export interface PieSlice {
    label: string
    value: number
    color: string
  }

  interface Props {
    data: PieSlice[]
    formatValue?: (value: number) => string
    emptyMessage?: string
    centerLabel?: string
    // Custom content for the donut's centre (e.g. the dashboard shows the
    // income-vs-expenses net position there instead of the raw total).
    center?: Snippet
  }

  let {
    data,
    formatValue = formatCurrency,
    emptyMessage = 'No income yet',
    centerLabel = 'Total',
    center,
  }: Props = $props()

  const size = 180
  const strokeWidth = 26
  const radius = (size - strokeWidth) / 2
  const midpoint = size / 2

  const total = $derived(data.reduce((sum, slice) => sum + slice.value, 0))

  const slices = $derived.by(() => {
    if (total <= 0) return []
    let startAngle = -90
    return data
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const sweep = (slice.value / total) * 360
        const part = { ...slice, startAngle, sweep }
        startAngle += sweep
        return part
      })
  })

  function polar(angleDeg: number): { x: number; y: number } {
    const radians = (angleDeg * Math.PI) / 180
    return { x: midpoint + radius * Math.cos(radians), y: midpoint + radius * Math.sin(radians) }
  }

  function arcPath(startAngle: number, sweep: number): string {
    const start = polar(startAngle)
    const end = polar(startAngle + sweep)
    const largeArc = sweep > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }
</script>

<div class="flex flex-wrap items-center justify-center gap-5">
  <div class="relative shrink-0" style="width: {size}px">
    {#if slices.length > 0}
      <svg
        viewBox="0 0 {size} {size}"
        class="w-full max-w-[180px]"
        role="img"
        aria-label="Donut chart with {slices.length} slice{slices.length === 1 ? '' : 's'}"
      >
        {#if slices.length === 1}
          <circle
            cx={midpoint}
            cy={midpoint}
            r={radius}
            fill="none"
            stroke={slices[0].color}
            stroke-width={strokeWidth}
          />
        {:else}
          {#each slices as slice (slice.label)}
            <path
              d={arcPath(slice.startAngle, slice.sweep)}
              fill="none"
              stroke={slice.color}
              stroke-width={strokeWidth}
            />
          {/each}
        {/if}
      </svg>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        {#if center}
          {@render center()}
        {:else}
          <span class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatValue(total)}
          </span>
          <span class="text-xs text-slate-400 dark:text-slate-500">{centerLabel}</span>
        {/if}
      </div>
    {:else}
      <p class="py-8 text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
    {/if}
  </div>

  {#if slices.length > 0}
    <ul class="min-w-40 flex-1 space-y-2">
      {#each slices as slice (slice.label)}
        <li class="flex items-center justify-between gap-3 text-sm">
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <span class="size-2.5 shrink-0 rounded-full" style="background: {slice.color}"></span>
            <span class="truncate text-slate-700 dark:text-slate-300">{slice.label}</span>
          </span>
          <span class="flex shrink-0 items-center gap-2">
            <span class="text-xs text-slate-400 dark:text-slate-500">
              {Math.round((slice.value / total) * 100)}%
            </span>
            <span class="font-medium text-slate-900 dark:text-slate-100">
              {formatValue(slice.value)}
            </span>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
