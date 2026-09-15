<script lang="ts">
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { expensesAdapter } from '$lib/outgoings/expenses'
</script>

<svelte:head>
  <title>Expenses · Bookkeeper</title>
</svelte:head>

<OutgoingsList adapter={expensesAdapter} />
