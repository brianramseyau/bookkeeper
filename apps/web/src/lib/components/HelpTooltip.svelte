<script lang="ts">
  import { mdiHelpCircle } from '@mdi/js'

  interface Props {
    /** Accessible name for the trigger button, e.g. "Why is this estimated?". */
    label: string
    text: string
    class?: string
  }

  let { label, text, class: className = '' }: Props = $props()

  let open = $state(false)
</script>

<span class="relative inline-flex {className}">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-label={label}
    title={text}
    aria-haspopup="true"
    aria-expanded={open}
    class="inline-flex shrink-0 items-center justify-center text-amber-500 transition-colors hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
  >
    <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
      <path d={mdiHelpCircle} />
    </svg>
  </button>

  {#if open}
    <button
      type="button"
      class="fixed inset-0 z-10 cursor-default"
      aria-label="Close tooltip"
      onclick={() => (open = false)}
    ></button>
    <span
      role="tooltip"
      class="absolute top-full left-1/2 z-20 mt-1 w-56 -translate-x-1/2 rounded-md border border-amber-200 bg-white p-2 text-xs font-normal text-slate-700 shadow-lg dark:border-amber-800 dark:bg-slate-800 dark:text-slate-200"
    >
      {text}
    </span>
  {/if}
</span>
