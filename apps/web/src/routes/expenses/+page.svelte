<script lang="ts">
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { expensesAdapter } from '$lib/outgoings/expenses'
</script>

<OutgoingsList adapter={expensesAdapter} />
