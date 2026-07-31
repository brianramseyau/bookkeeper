<script lang="ts">
  interface Props {
    onclick: (event: MouseEvent) => void
    /** Rarely needed - e.g. preventing an adjacent input's blur handler from firing before this click registers. */
    onmousedown?: (event: MouseEvent) => void
    disabled?: boolean
    variant?: 'neutral' | 'danger' | 'primary' | 'cancel' | 'amber' | 'muted' | 'success'
    /** Accessible name and desktop hover tooltip - always pass a specific, human-readable action, e.g. "Edit Groceries". */
    label: string
    /** An `mdi*` path constant from '@mdi/js'. */
    path: string
    class?: string
  }

  let {
    onclick,
    onmousedown,
    disabled = false,
    variant = 'neutral',
    label,
    path,
    class: className = '',
  }: Props = $props()

  const VARIANTS = {
    neutral:
      'text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400',
    danger:
      'text-slate-300 hover:bg-slate-100 hover:text-red-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-red-400',
    primary:
      'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300',
    cancel:
      'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300',
    amber:
      'text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-amber-400',
    muted:
      'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300',
    success:
      'text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-emerald-400',
  }
</script>

<button
  type="button"
  {onclick}
  {onmousedown}
  {disabled}
  aria-label={label}
  title={label}
  class={[
    'inline-flex shrink-0 items-center justify-center rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
    VARIANTS[variant],
    className,
  ]}
>
  <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
</button>
