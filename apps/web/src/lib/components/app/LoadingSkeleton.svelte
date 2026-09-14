<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton'

  interface Props {
    /** How many placeholder lines to show. */
    rows?: number
    class?: string
  }

  let { rows = 3, class: className = '' }: Props = $props()
</script>

<div class={['flex flex-col gap-2', className]} role="status" aria-label="Loading">
  {#each { length: rows } as _, i (i)}
    <Skeleton class={i === rows - 1 && rows > 1 ? 'h-4 w-2/3' : 'h-4 w-full'} />
  {/each}
</div>
