<script lang="ts">
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { utilitiesAdapter } from '$lib/outgoings/utilities'
</script>

<svelte:head>
  <title>Utilities · Bookkeeper</title>
</svelte:head>

<OutgoingsList adapter={utilitiesAdapter} />
