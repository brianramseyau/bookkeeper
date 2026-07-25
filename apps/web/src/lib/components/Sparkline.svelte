<script lang="ts">
  import { themeState } from '$lib/stores/theme.svelte'

  interface Props {
    values: number[]
    trend: 'up' | 'down' | 'flat' | null
    width?: number
    height?: number
  }

  let { values, trend, width = 96, height = 28 }: Props = $props()

  const COLORS = {
    up: { light: '#dc2626', dark: '#f87171' },
    down: { light: '#059669', dark: '#34d399' },
    flat: { light: '#94a3b8', dark: '#64748b' },
    none: { light: '#cbd5e1', dark: '#475569' },
  }

  const ringColor = $derived(themeState.current === 'dark' ? '#1e293b' : '#ffffff')
  const strokeColor = $derived(COLORS[trend ?? 'none'][themeState.current])

  const padding = 3
  const points = $derived.by(() => {
    if (values.length < 2) return []
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const stepX = (width - padding * 2) / (values.length - 1)
    return values.map((value, index) => ({
      x: padding + index * stepX,
      y: height - padding - ((value - min) / range) * (height - padding * 2),
    }))
  })

  const path = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' '))
  const last = $derived(points[points.length - 1])
</script>

{#if points.length >= 2}
  <svg viewBox="0 0 {width} {height}" {width} {height} class="overflow-visible">
    <path d={path} fill="none" stroke={strokeColor} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    {#if last}
      <circle cx={last.x} cy={last.y} r="4" fill={strokeColor} stroke={ringColor} stroke-width="2" />
    {/if}
  </svg>
{/if}
