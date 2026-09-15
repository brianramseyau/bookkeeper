<script lang="ts">
  import { page } from '$app/state'
  import OutgoingDetail from '$lib/outgoings/OutgoingDetail.svelte'
  import { billsAdapter } from '$lib/outgoings/bills'

  // Derived (not a plain const) so navigating /bills/1 -> /bills/2 reuses the
  // route component with the new id; {#key} then remounts the detail for it.
  const billId = $derived(Number(page.params.billId))
</script>

{#key billId}
  <OutgoingDetail adapter={billsAdapter} id={billId} />
{/key}
