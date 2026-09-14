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
      'text-due inline-flex shrink-0 items-center justify-center transition-opacity hover:opacity-75',
      className,
    ]}
  >
    <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
      <path d={mdiHelpCircle} />
    </svg>
  </PopoverTrigger>
  <!-- Not role="tooltip" - PopoverTrigger already sets aria-haspopup="dialog"/
       aria-expanded on the trigger, and a true ARIA tooltip is non-interactive
       hover-triggered description text, which contradicts this panel's actual
       click-to-open, focus-managed popover behaviour. role="status" instead:
       the explanation is announced (implicit aria-live="polite") the moment it
       appears, which is what actually matters on a phone with no hover state
       to reveal a native title tooltip. -->
  <PopoverContent role="status" align="center" class="border-due/30 w-56 p-2 text-xs">
    {text}
  </PopoverContent>
</Popover>
