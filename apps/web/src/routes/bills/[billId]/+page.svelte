<script lang="ts">
  import { page } from '$app/state'
  import OutgoingDetail from '$lib/outgoings/OutgoingDetail.svelte'
  import { billsAdapter } from '$lib/outgoings/bills'

  const billId = Number(page.params.billId)
</script>

<svelte:head>
  <title>Bill · Bookkeeper</title>
</svelte:head>

<OutgoingDetail adapter={billsAdapter} id={billId} />
