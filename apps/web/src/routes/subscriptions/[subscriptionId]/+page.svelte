<script lang="ts">
  import { page } from '$app/state'
  import OutgoingDetail from '$lib/outgoings/OutgoingDetail.svelte'
  import { subscriptionsAdapter } from '$lib/outgoings/subscriptions'

  const subscriptionId = $derived(Number(page.params.subscriptionId))
</script>

{#key subscriptionId}
  <OutgoingDetail adapter={subscriptionsAdapter} id={subscriptionId} />
{/key}
