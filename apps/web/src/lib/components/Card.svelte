<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    href?: string
    children: Snippet
  }

  let { class: className = '', href, children }: Props = $props()

  const base =
    'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800'
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
