<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** An invitation to act, not just a statement of absence - see
        DESIGN.md → Copy rules, e.g. "No bills yet. Add the first one to
        see when it's due." */
    message: string
    /** A "Add X" button/link, shown under the message. */
    action?: Snippet
    class?: string
  }

  let { message, action, class: className = '' }: Props = $props()
</script>

<div class={['flex flex-col items-center gap-3 px-3 py-8 text-center', className]}>
  <p class="text-muted-foreground text-sm">{message}</p>
  {#if action}
    {@render action()}
  {/if}
</div>
