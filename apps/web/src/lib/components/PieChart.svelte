<script lang="ts">
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
  }

  let {
    data,
    formatValue = formatCurrency,
    emptyMessage = 'No income yet',
    centerLabel = 'Total',
  }: Props = $props()

  const size = 180
  const strokeWidth = 26
  const radius = (size - strokeWidth) / 2
  const center = size / 2

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
    return { x: center + radius * Math.cos(radians), y: center + radius * Math.sin(radians) }
  }

  function arcPath(startAngle: number, sweep: number): string {
    const start = polar(startAngle)
    const end = polar(startAngle + sweep)
    const largeArc = sweep > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }
</script>

<div class="flex flex-col gap-5 sm:flex-row sm:items-center">
  <div class="relative mx-auto shrink-0 sm:mx-0">
    {#if slices.length > 0}
      <svg
        viewBox="0 0 {size} {size}"
        class="w-full max-w-[180px]"
        role="img"
        aria-label="Donut chart with {slices.length} slice{slices.length === 1 ? '' : 's'}"
      >
        {#if slices.length === 1}
          <circle
            cx={center}
            cy={center}
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
        <span class="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {formatValue(total)}
        </span>
        <span class="text-xs text-slate-400 dark:text-slate-500">{centerLabel}</span>
      </div>
    {:else}
      <p class="py-8 text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
    {/if}
  </div>

  {#if slices.length > 0}
    <ul class="min-w-0 flex-1 space-y-2">
      {#each slices as slice (slice.label)}
        <li class="flex items-center justify-between gap-3 text-sm">
          <span class="flex min-w-0 items-center gap-2">
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
