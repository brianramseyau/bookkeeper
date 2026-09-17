<script lang="ts">
  import { onMount } from 'svelte'
  import type { Expense } from '$lib/api/expenses'
  import {
    listExpenseActuals,
    createExpenseActual,
    updateExpenseActual,
    deleteExpenseActual,
    type ExpenseMonthlyActual,
  } from '$lib/api/expense-actuals'
  import {
    listExpenseBudgetItems,
    createExpenseBudgetItem,
    updateExpenseBudgetItem,
    deleteExpenseBudgetItem,
    type ExpenseBudgetItem,
  } from '$lib/api/expense-budget-items'
  import { formatCurrency, formatMonthYear } from '$lib/format'
  import { monthValueToLastDayIso } from '$lib/standard-month-line'
  import { ApiError } from '$lib/api'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import { Button } from '$lib/components/ui/button'
  import { mdiPencil, mdiDelete } from '@mdi/js'
  import BudgetItemFormSheet, { type BudgetItemFormValues } from './BudgetItemFormSheet.svelte'
  import ExpenseActualFormSheet, {
    type ExpenseActualFormValues,
  } from './ExpenseActualFormSheet.svelte'

  interface Props {
    expenseId: number
    expense: Expense
    /** Called after a budget-item change, since it can change the expense's derived budget. */
    onChanged: () => Promise<void>
  }

  let { expenseId, expense, onChanged }: Props = $props()

  let actuals = $state<ExpenseMonthlyActual[]>([])
  let budgetItems = $state<ExpenseBudgetItem[]>([])
  let error = $state<string | null>(null)

  let itemFormOpen = $state(false)
  let itemFormTarget = $state<ExpenseBudgetItem | null>(null)
  let itemFormSubmitting = $state(false)
  let itemFormError = $state<string | null>(null)

  let actualFormOpen = $state(false)
  let actualFormTarget = $state<ExpenseMonthlyActual | null>(null)
  let actualFormSubmitting = $state(false)
  let actualFormError = $state<string | null>(null)

  const sortedActuals = $derived(
    [...actuals].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
  )
  const budgetItemsTotal = $derived(budgetItems.reduce((sum, item) => sum + item.amount, 0))

  onMount(load)

  async function load() {
    error = null
    try {
      const [actualList, itemList] = await Promise.all([
        listExpenseActuals(expenseId),
        listExpenseBudgetItems(expenseId),
      ])
      actuals = actualList
      budgetItems = itemList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load'
    }
  }

  function openAddItem() {
    itemFormTarget = null
    itemFormError = null
    itemFormOpen = true
  }

  function openEditItem(item: ExpenseBudgetItem) {
    itemFormTarget = item
    itemFormError = null
    itemFormOpen = true
  }

  async function submitItem(values: BudgetItemFormValues) {
    itemFormSubmitting = true
    itemFormError = null
    try {
      if (itemFormTarget) {
        await updateExpenseBudgetItem(itemFormTarget.id, values)
      } else {
        await createExpenseBudgetItem(expenseId, values)
      }
      itemFormOpen = false
      budgetItems = await listExpenseBudgetItems(expenseId)
      await onChanged()
    } catch (err) {
      itemFormError = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      itemFormSubmitting = false
    }
  }

  async function handleDeleteItem(item: ExpenseBudgetItem) {
    const confirmed = await confirmDestructive({
      title: `Delete "${item.name}"?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    error = null
    try {
      await deleteExpenseBudgetItem(item.id)
      budgetItems = budgetItems.filter((i) => i.id !== item.id)
      await onChanged()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  function itemMenuActions(item: ExpenseBudgetItem) {
    return [
      {
        label: 'Edit',
        path: mdiPencil,
        variant: 'neutral' as const,
        onclick: () => openEditItem(item),
      },
      {
        label: 'Delete',
        path: mdiDelete,
        variant: 'danger' as const,
        onclick: () => handleDeleteItem(item),
      },
    ]
  }

  function openAddActual() {
    actualFormTarget = null
    actualFormError = null
    actualFormOpen = true
  }

  function openEditActual(actual: ExpenseMonthlyActual) {
    actualFormTarget = actual
    actualFormError = null
    actualFormOpen = true
  }

  async function submitActual(values: ExpenseActualFormValues) {
    actualFormSubmitting = true
    actualFormError = null
    try {
      const input = {
        occurredOn: monthValueToLastDayIso(values.occurredMonth),
        amount: values.amount,
        notes: values.notes === '' ? null : values.notes,
      }
      if (actualFormTarget) {
        await updateExpenseActual(actualFormTarget.id, input)
      } else {
        await createExpenseActual(expenseId, input)
      }
      actualFormOpen = false
      actuals = await listExpenseActuals(expenseId)
    } catch (err) {
      actualFormError = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      actualFormSubmitting = false
    }
  }

  async function handleDeleteActual(actual: ExpenseMonthlyActual) {
    const confirmed = await confirmDestructive({
      title: `Delete the ${formatMonthYear(actual.occurredOn)} entry?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    error = null
    try {
      await deleteExpenseActual(actual.id)
      actuals = actuals.filter((a) => a.id !== actual.id)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  function actualMenuActions(actual: ExpenseMonthlyActual) {
    return [
      {
        label: 'Edit',
        path: mdiPencil,
        variant: 'neutral' as const,
        onclick: () => openEditActual(actual),
      },
      {
        label: 'Delete',
        path: mdiDelete,
        variant: 'danger' as const,
        onclick: () => handleDeleteActual(actual),
      },
    ]
  }
</script>

{#if error}
  <div class="mt-4"><ErrorMessage message={error} /></div>
{/if}

<div class="mt-8">
  <div class="mb-3 flex items-end justify-between gap-3">
    <div>
      <h2 class="text-foreground text-lg font-semibold">Budget breakdown</h2>
      <p class="text-muted-foreground mt-1 text-sm">
        What makes up the budget target above, itemized - e.g. insurance, food, grooming for a "Dog"
        expense.
      </p>
    </div>
    <Button size="sm" onclick={openAddItem}>Add item</Button>
  </div>

  {#if budgetItems.length === 0 && expense.budgetAmount !== null}
    <p class="border-due-tint bg-due-tint text-due mb-3 rounded-lg border px-3 py-2 text-sm">
      This expense has a manually-set budget of {formatCurrency(expense.budgetAmount)}. Adding an
      item below will replace it with the sum of your itemized items going forward.
    </p>
  {/if}

  <Card class="sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-border border-b">
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Item</th>
          <th class="text-muted-foreground px-3 py-2 text-right font-medium">Amount</th>
          <th class="w-12"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each budgetItems as item (item.id)}
          <tr
            class="divide-border border-border bg-card sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
          >
            <td class="text-foreground px-3 py-2 font-medium sm:table-cell">{item.name}</td>
            <td
              class="text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
              {formatCurrency(item.amount)}
            </td>
            <td class="px-3 py-2 text-right whitespace-nowrap sm:table-cell">
              <ActionMenu label="Actions for {item.name}" actions={itemMenuActions(item)} />
            </td>
          </tr>
        {:else}
          <tr class="block sm:table-row">
            <td
              colspan="3"
              class="text-muted-foreground block px-3 py-6 text-center text-sm sm:table-cell"
            >
              No items yet.
            </td>
          </tr>
        {/each}
      </tbody>
      {#if budgetItems.length > 0}
        <tfoot class="block sm:table-footer-group">
          <tr
            class="border-border mt-1 block border-t pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0"
          >
            <td class="text-foreground px-3 py-2 sm:table-cell">Total</td>
            <td
              class="text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
              {formatCurrency(budgetItemsTotal)}
            </td>
            <td class="hidden px-3 py-2 sm:table-cell"></td>
          </tr>
        </tfoot>
      {/if}
    </table>
  </Card>
</div>

<div class="mt-8">
  <div class="mb-3 flex items-end justify-between gap-3">
    <div>
      <h2 class="text-foreground text-lg font-semibold">Monthly actuals</h2>
      <p class="text-muted-foreground mt-1 text-sm">What this expense actually cost, by month.</p>
    </div>
    <Button size="sm" onclick={openAddActual}>Add entry</Button>
  </div>

  <Card class="sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-border border-b">
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Month</th>
          <th class="text-muted-foreground px-3 py-2 text-right font-medium">Amount</th>
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Notes</th>
          <th class="w-12"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each sortedActuals as actual (actual.id)}
          <tr
            class="divide-border border-border bg-card sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
          >
            <td class="text-foreground px-3 py-2 sm:table-cell"
              >{formatMonthYear(actual.occurredOn)}</td
            >
            <td
              class="text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
              {formatCurrency(actual.amount)}
            </td>
            <td
              class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Notes</span>
              {actual.notes ?? ''}
            </td>
            <td class="px-3 py-2 text-right whitespace-nowrap sm:table-cell">
              <ActionMenu
                label="Actions for the {formatMonthYear(actual.occurredOn)} entry"
                actions={actualMenuActions(actual)}
              />
            </td>
          </tr>
        {:else}
          <tr class="block sm:table-row">
            <td
              colspan="4"
              class="text-muted-foreground block px-3 py-6 text-center text-sm sm:table-cell"
            >
              No entries yet.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
</div>

<BudgetItemFormSheet
  open={itemFormOpen}
  onOpenChange={(open) => {
    itemFormOpen = open
    if (!open) itemFormTarget = null
  }}
  item={itemFormTarget}
  submitting={itemFormSubmitting}
  error={itemFormError}
  onSubmit={submitItem}
/>

<ExpenseActualFormSheet
  open={actualFormOpen}
  onOpenChange={(open) => {
    actualFormOpen = open
    if (!open) actualFormTarget = null
  }}
  item={actualFormTarget}
  submitting={actualFormSubmitting}
  error={actualFormError}
  onSubmit={submitActual}
/>
