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
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import { Button } from '$lib/components/ui/button'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import MonthYearPicker from '$lib/components/MonthYearPicker.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete } from '@mdi/js'

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

  let actualMonth = $state('')
  let amount = $state<number>(NaN)
  let notes = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editActualMonth = $state('')
  let editAmount = $state<number>(NaN)
  let editNotes = $state('')
  let savingEdit = $state(false)

  let itemName = $state('')
  let itemAmount = $state<number>(NaN)
  let creatingItem = $state(false)

  let editingItemId = $state<number | null>(null)
  let editItemName = $state('')
  let editItemAmount = $state<number>(NaN)
  let savingItemEdit = $state(false)

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

  async function handleAddItem(event: SubmitEvent) {
    event.preventDefault()
    if (!itemName.trim() || Number.isNaN(itemAmount) || itemAmount === null) {
      error = 'Name and amount are required'
      return
    }
    creatingItem = true
    error = null
    try {
      await createExpenseBudgetItem(expenseId, { name: itemName.trim(), amount: itemAmount })
      itemName = ''
      itemAmount = NaN
      budgetItems = await listExpenseBudgetItems(expenseId)
      await onChanged()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add item'
    } finally {
      creatingItem = false
    }
  }

  function startEditItem(item: ExpenseBudgetItem) {
    editingItemId = item.id
    editItemName = item.name
    editItemAmount = item.amount
  }

  async function saveItemEdit(item: ExpenseBudgetItem) {
    if (!editItemName.trim() || Number.isNaN(editItemAmount) || editItemAmount === null) {
      error = 'Name and amount are required'
      return
    }
    savingItemEdit = true
    error = null
    try {
      await updateExpenseBudgetItem(item.id, { name: editItemName.trim(), amount: editItemAmount })
      editingItemId = null
      budgetItems = await listExpenseBudgetItems(expenseId)
      await onChanged()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingItemEdit = false
    }
  }

  async function handleDeleteItem(item: ExpenseBudgetItem) {
    error = null
    try {
      await deleteExpenseBudgetItem(item.id)
      budgetItems = budgetItems.filter((i) => i.id !== item.id)
      await onChanged()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handleAddActual(event: SubmitEvent) {
    event.preventDefault()
    if (!actualMonth || Number.isNaN(amount) || amount === null) {
      error = 'Month and amount are required'
      return
    }
    creating = true
    error = null
    try {
      await createExpenseActual(expenseId, {
        occurredOn: monthValueToLastDayIso(actualMonth),
        amount,
        notes: notes.trim() === '' ? undefined : notes.trim(),
      })
      actualMonth = ''
      amount = NaN
      notes = ''
      actuals = await listExpenseActuals(expenseId)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add entry'
    } finally {
      creating = false
    }
  }

  function startEdit(actual: ExpenseMonthlyActual) {
    editingId = actual.id
    editActualMonth = actual.occurredOn.slice(0, 7)
    editAmount = actual.amount
    editNotes = actual.notes ?? ''
  }

  async function saveEdit(actual: ExpenseMonthlyActual) {
    if (!editActualMonth || Number.isNaN(editAmount) || editAmount === null) {
      error = 'Month and amount are required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateExpenseActual(actual.id, {
        occurredOn: monthValueToLastDayIso(editActualMonth),
        amount: editAmount,
        notes: editNotes.trim() === '' ? null : editNotes.trim(),
      })
      editingId = null
      actuals = await listExpenseActuals(expenseId)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }

  async function handleDelete(actual: ExpenseMonthlyActual) {
    error = null
    try {
      await deleteExpenseActual(actual.id)
      actuals = actuals.filter((a) => a.id !== actual.id)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }
</script>

{#if error}
  <div class="mt-4"><ErrorMessage message={error} /></div>
{/if}

<div class="mt-8">
  <h2 class="text-foreground text-lg font-semibold">Budget breakdown</h2>
  <p class="text-muted-foreground mt-1 mb-3 text-sm">
    What makes up the budget target above, itemized - e.g. insurance, food, grooming for a "Dog"
    expense.
  </p>

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
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each budgetItems as item (item.id)}
          {#if editingItemId === item.id}
            <tr
              class="divide-border border-primary/40 bg-accent sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:last:border-0"
            >
              <td class="px-3 py-2 sm:table-cell">
                <input
                  type="text"
                  bind:value={editItemName}
                  class="border-input w-full rounded-md border bg-transparent px-2 py-1 text-sm sm:w-32"
                />
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
              >
                <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editItemAmount}
                  class="border-input w-full rounded-md border bg-transparent px-2 py-1 text-right text-sm sm:w-24"
                />
              </td>
              <td
                class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                <IconActionButton
                  variant="primary"
                  disabled={savingItemEdit}
                  label="Save {item.name}"
                  path={mdiContentSave}
                  onclick={() => saveItemEdit(item)}
                />
                <IconActionButton
                  variant="cancel"
                  label="Cancel editing {item.name}"
                  path={mdiCloseThick}
                  onclick={() => (editingItemId = null)}
                />
              </td>
            </tr>
          {:else}
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
              <td
                class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                <IconActionButton
                  variant="neutral"
                  label="Edit {item.name}"
                  path={mdiPencil}
                  onclick={() => startEditItem(item)}
                />
                <IconActionButton
                  variant="danger"
                  label="Delete {item.name}"
                  path={mdiDelete}
                  onclick={() => handleDeleteItem(item)}
                />
              </td>
            </tr>
          {/if}
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

  <form
    onsubmit={handleAddItem}
    class="border-border bg-card mt-4 flex flex-wrap items-end gap-3 rounded-xl border p-4"
  >
    <label class="flex flex-col gap-1">
      <span class="text-muted-foreground text-xs font-medium">Item</span>
      <input
        type="text"
        placeholder="e.g. Insurance"
        bind:value={itemName}
        class="border-input w-40 rounded-md border bg-transparent px-2 py-1.5 text-sm"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-muted-foreground text-xs font-medium">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={itemAmount}
        class="border-input w-28 rounded-md border bg-transparent px-2 py-1.5 text-sm"
      />
    </label>
    <Button type="submit" disabled={creatingItem}>
      {creatingItem ? 'Adding…' : 'Add item'}
    </Button>
  </form>
</div>

<div class="mt-8">
  <h2 class="text-foreground text-lg font-semibold">Monthly actuals</h2>
  <p class="text-muted-foreground mt-1 mb-3 text-sm">What this expense actually cost, by month.</p>

  <Card class="sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-border border-b">
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Month</th>
          <th class="text-muted-foreground px-3 py-2 text-right font-medium">Amount</th>
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Notes</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each sortedActuals as actual (actual.id)}
          {#if editingId === actual.id}
            <tr
              class="divide-border border-primary/40 bg-accent sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:last:border-0"
            >
              <td class="px-3 py-2 sm:table-cell">
                <MonthYearPicker bind:value={editActualMonth} size="table" />
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
              >
                <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editAmount}
                  class="border-input w-full rounded-md border bg-transparent px-2 py-1 text-right text-sm sm:w-24"
                />
              </td>
              <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Notes</span>
                <input
                  type="text"
                  bind:value={editNotes}
                  class="border-input w-full rounded-md border bg-transparent px-2 py-1 text-sm sm:w-40"
                />
              </td>
              <td
                class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                <IconActionButton
                  variant="primary"
                  disabled={savingEdit}
                  label="Save entry from {formatMonthYear(actual.occurredOn)}"
                  path={mdiContentSave}
                  onclick={() => saveEdit(actual)}
                />
                <IconActionButton
                  variant="cancel"
                  label="Cancel editing entry from {formatMonthYear(actual.occurredOn)}"
                  path={mdiCloseThick}
                  onclick={() => (editingId = null)}
                />
              </td>
            </tr>
          {:else}
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
              <td
                class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                <IconActionButton
                  variant="neutral"
                  label="Edit entry from {formatMonthYear(actual.occurredOn)}"
                  path={mdiPencil}
                  onclick={() => startEdit(actual)}
                />
                <IconActionButton
                  variant="danger"
                  label="Delete entry from {formatMonthYear(actual.occurredOn)}"
                  path={mdiDelete}
                  onclick={() => handleDelete(actual)}
                />
              </td>
            </tr>
          {/if}
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

  <form
    onsubmit={handleAddActual}
    class="border-border bg-card mt-4 flex flex-wrap items-end gap-3 rounded-xl border p-4"
  >
    <label class="flex flex-col gap-1">
      <span class="text-muted-foreground text-xs font-medium">Month</span>
      <MonthYearPicker bind:value={actualMonth} size="form" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-muted-foreground text-xs font-medium">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={amount}
        class="border-input w-28 rounded-md border bg-transparent px-2 py-1.5 text-sm"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-muted-foreground text-xs font-medium">Notes</span>
      <input
        type="text"
        bind:value={notes}
        placeholder="optional"
        class="border-input w-40 rounded-md border bg-transparent px-2 py-1.5 text-sm"
      />
    </label>
    <Button type="submit" disabled={creating}>{creating ? 'Adding…' : 'Add entry'}</Button>
  </form>
</div>
