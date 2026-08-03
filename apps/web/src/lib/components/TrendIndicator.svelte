<script lang="ts">
  interface Props {
    trend: 'up' | 'down' | 'flat' | null | undefined
    suffix?: string
    class?: string
    as?: 'span' | 'p'
    /** Render just the ▲/▼/— glyph (with a title tooltip) instead of the "up"/"down"/"flat" word - for tight spaces like a merged average+trend column. */
    caretOnly?: boolean
  }

  let {
    trend,
    suffix = '',
    class: className = 'text-sm font-medium',
    as = 'span',
    caretOnly = false,
  }: Props = $props()

  const LABELS = { up: '▲ up', down: '▼ down', flat: '— flat' }
  const CARETS = { up: '▲', down: '▼', flat: '—' }
  const TITLES = { up: 'Trending up', down: 'Trending down', flat: 'Flat' }
  const COLORS = {
    up: 'text-red-600 dark:text-red-400',
    down: 'text-emerald-600 dark:text-emerald-400',
    flat: 'text-slate-400 dark:text-slate-500',
  }
</script>

{#if trend}
  {@const text = caretOnly
    ? CARETS[trend]
    : trend === 'flat'
      ? LABELS[trend]
      : `${LABELS[trend]}${suffix}`}
  {@const title = caretOnly ? TITLES[trend] : undefined}
  {#if as === 'p'}
    <p class={[className, COLORS[trend]]} {title}>{text}</p>
  {:else}
    <span class={[className, COLORS[trend]]} {title}>{text}</span>
  {/if}
{/if}
