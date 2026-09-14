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

  // Cards are `surface` with a `rule` border and no shadow - only floating
  // surfaces (menus, sheets, dialogs) get elevation. See DESIGN.md → Layout.
  const base = $derived(
    pivotTable
      ? 'rounded-none border-0 bg-transparent sm:rounded-xl sm:border sm:border-border sm:bg-card'
      : 'rounded-xl border border-border bg-card'
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
