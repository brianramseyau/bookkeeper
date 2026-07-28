<script lang="ts">
  interface Props {
    trend: 'up' | 'down' | 'flat' | null | undefined
    suffix?: string
    class?: string
    as?: 'span' | 'p'
  }

  let {
    trend,
    suffix = '',
    class: className = 'text-sm font-medium',
    as = 'span',
  }: Props = $props()

  const LABELS = { up: '▲ up', down: '▼ down', flat: '— flat' }
  const COLORS = {
    up: 'text-red-600 dark:text-red-400',
    down: 'text-emerald-600 dark:text-emerald-400',
    flat: 'text-slate-400 dark:text-slate-500',
  }
</script>

{#if trend}
  {@const text = trend === 'flat' ? LABELS[trend] : `${LABELS[trend]}${suffix}`}
  {#if as === 'p'}
    <p class={[className, COLORS[trend]]}>{text}</p>
  {:else}
    <span class={[className, COLORS[trend]]}>{text}</span>
  {/if}
{/if}
