<script lang="ts">
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { utilitiesAdapter } from '$lib/outgoings/utilities'
</script>

<OutgoingsList adapter={utilitiesAdapter} />
