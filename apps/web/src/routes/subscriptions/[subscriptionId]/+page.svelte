<script lang="ts">
  import { page } from '$app/state'
  import OutgoingDetail from '$lib/outgoings/OutgoingDetail.svelte'
  import { subscriptionsAdapter } from '$lib/outgoings/subscriptions'

  const subscriptionId = Number(page.params.subscriptionId)
</script>

<svelte:head>
  <title>Subscription · Bookkeeper</title>
</svelte:head>

<OutgoingDetail adapter={subscriptionsAdapter} id={subscriptionId} />
