<script lang="ts">
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { billsAdapter } from '$lib/outgoings/bills'
</script>

<svelte:head>
  <title>Bills · Bookkeeper</title>
</svelte:head>

<OutgoingsList adapter={billsAdapter} />
