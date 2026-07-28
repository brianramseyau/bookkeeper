<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    onclick: (event: MouseEvent) => void
    disabled?: boolean
    variant?: 'neutral' | 'danger' | 'primary' | 'cancel' | 'amber' | 'muted' | 'success'
    class?: string
    children: Snippet
  }

  let {
    onclick,
    disabled = false,
    variant = 'neutral',
    class: className = '',
    children,
  }: Props = $props()

  const VARIANTS = {
    neutral: 'text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400',
    danger: 'text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400',
    primary:
      'font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300',
    cancel: 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
    amber: 'text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400',
    muted: 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300',
    success:
      'text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400',
  }
</script>

<button
  type="button"
  {onclick}
  {disabled}
  class={['text-xs disabled:cursor-not-allowed disabled:opacity-60', VARIANTS[variant], className]}
>
  {@render children()}
</button>
