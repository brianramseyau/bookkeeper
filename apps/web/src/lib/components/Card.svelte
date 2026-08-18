<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    href?: string
    // Card wraps a table that reflows to stacked tiles below `sm`; strip the
    // card chrome (background/border/shadow/rounding) on mobile so each tile
    // reads as a separate card against the page background, restore it at `sm`.
    pivotTable?: boolean
    children: Snippet
  }

  let { class: className = '', href, pivotTable = false, children }: Props = $props()

  const base = $derived(
    pivotTable
      ? 'rounded-none border-0 bg-transparent shadow-none sm:rounded-xl sm:border sm:border-slate-200 sm:bg-white sm:shadow-sm sm:dark:border-slate-800 sm:dark:bg-slate-800'
      : 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800'
  )
</script>

{#if href}
  <a {href} class={[base, className]}>
    {@render children()}
  </a>
{:else}
  <div class={[base, className]}>
    {@render children()}
  </div>
{/if}
