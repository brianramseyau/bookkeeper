<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    onclick?: (event: MouseEvent) => void
    href?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    class?: string
    children: Snippet
  }

  let {
    onclick,
    href,
    type = 'button',
    disabled = false,
    size = 'md',
    class: className = '',
    children,
  }: Props = $props()

  const SIZES = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-1.5',
    lg: 'px-4 py-2',
  }

  const base =
    'rounded-md border border-slate-300 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
</script>

{#if href}
  <a {href} class={[base, SIZES[size], className]}>
    {@render children()}
  </a>
{:else}
  <button {type} {onclick} {disabled} class={[base, SIZES[size], className]}>
    {@render children()}
  </button>
{/if}
