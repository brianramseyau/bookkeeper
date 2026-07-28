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
    'rounded-md bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400'
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
