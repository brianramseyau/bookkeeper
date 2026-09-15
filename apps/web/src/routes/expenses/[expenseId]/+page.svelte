<script lang="ts">
  import { page } from '$app/state'
  import type { Expense } from '$lib/api/expenses'
  import OutgoingDetail from '$lib/outgoings/OutgoingDetail.svelte'
  import ExpenseBreakdown from '$lib/outgoings/ExpenseBreakdown.svelte'
  import { expensesAdapter } from '$lib/outgoings/expenses'

  const expenseId = $derived(Number(page.params.expenseId))
</script>

<svelte:head>
  <title>Expense · Bookkeeper</title>
</svelte:head>

{#key expenseId}
  <OutgoingDetail adapter={expensesAdapter} id={expenseId}>
    {#snippet extra(item, refresh)}
      <ExpenseBreakdown {expenseId} expense={item as Expense} onChanged={refresh} />
    {/snippet}
  </OutgoingDetail>
{/key}
