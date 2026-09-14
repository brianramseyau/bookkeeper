<script lang="ts">
  import { mdiHelpCircle } from '@mdi/js'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'

  interface Props {
    /** Accessible name for the trigger button, e.g. "Why is this estimated?". */
    label: string
    text: string
    class?: string
  }

  let { label, text, class: className = '' }: Props = $props()
</script>

<Popover>
  <PopoverTrigger
    aria-label={label}
    title={text}
    class={[
      'inline-flex shrink-0 items-center justify-center text-amber-500 transition-colors hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300',
      className,
    ]}
  >
    <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
      <path d={mdiHelpCircle} />
    </svg>
  </PopoverTrigger>
  <PopoverContent
    role="tooltip"
    align="center"
    class="w-56 border-amber-200 bg-white p-2 text-xs font-normal text-slate-700 shadow-lg dark:border-amber-800 dark:bg-slate-800 dark:text-slate-200"
  >
    {text}
  </PopoverContent>
</Popover>
