<script lang="ts">
  import { page } from '$app/state'
  import type { Utility } from '$lib/api/utilities'
  import OutgoingDetail from '$lib/outgoings/OutgoingDetail.svelte'
  import UtilityBillsGrid from '$lib/outgoings/UtilityBillsGrid.svelte'
  import { utilitiesAdapter } from '$lib/outgoings/utilities'

  const utilityId = Number(page.params.utilityId)
</script>

<svelte:head>
  <title>Utility · Bookkeeper</title>
</svelte:head>

<OutgoingDetail adapter={utilitiesAdapter} id={utilityId}>
  {#snippet extra(item, refresh)}
    <UtilityBillsGrid utility={item as Utility} onChanged={refresh} />
  {/snippet}
</OutgoingDetail>
