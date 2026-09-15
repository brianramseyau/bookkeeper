<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** How many columns at `sm` and up - one column below that regardless. */
    cols?: 2 | 3 | 4
    children: Snippet
  }

  let { cols = 3, children }: Props = $props()

  const COLS = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }
</script>

<div class={['grid grid-cols-1 gap-4', COLS[cols]]}>
  {@render children()}
</div>
