<script lang="ts">
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { billsAdapter } from '$lib/outgoings/bills'
</script>

<OutgoingsList adapter={billsAdapter} />
