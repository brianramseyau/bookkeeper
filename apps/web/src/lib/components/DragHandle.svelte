<script lang="ts">
  import { dragHandle } from 'svelte-dnd-action'
  import { mdiDrag } from '@mdi/js'

  interface Props {
    /** Accessible name - always pass a specific, human-readable item, e.g. "Move Groceries". */
    label: string
    /** Smaller padding/icon for dense tables (e.g. Categories) that don't need the full touch-target size. */
    compact?: boolean
  }

  let { label, compact = false }: Props = $props()
</script>

<span
  use:dragHandle
  aria-label={label}
  title={label}
  class="inline-flex shrink-0 touch-none items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600 active:cursor-grabbing dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400 {compact
    ? 'p-1'
    : 'p-2'}"
  style="cursor: grab"
>
  <svg
    viewBox="0 0 24 24"
    class={compact ? 'size-4' : 'size-5'}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d={mdiDrag} />
  </svg>
</span>
