<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { listExpenses, updateExpense, type Expense } from '$lib/api/expenses'
  import {
    listExpenseActuals,
    getExpenseTrend,
    createExpenseActual,
    updateExpenseActual,
    deleteExpenseActual,
    type ExpenseMonthlyActual,
    type ExpenseTrend,
  } from '$lib/api/expense-actuals'
  import {
    listExpenseBudgetItems,
    createExpenseBudgetItem,
    updateExpenseBudgetItem,
    deleteExpenseBudgetItem,
    type ExpenseBudgetItem,
  } from '$lib/api/expense-budget-items'
  import { listCategories, type Category } from '$lib/api/categories'
  import { formatCurrency, formatMonthYear } from '$lib/format'
  import { monthValueToLastDayIso } from '$lib/standard-month-line'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import { Button } from '$lib/components/ui/button'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'
  import CategorySelect from '$lib/components/CategorySelect.svelte'
  import MonthYearPicker from '$lib/components/MonthYearPicker.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete } from '@mdi/js'

  const expenseId = Number(page.params.expenseId)

  let expense = $state<Expense | null>(null)
  let categories = $state<Category[]>([])
  let actuals = $state<ExpenseMonthlyActual[]>([])
  let trend = $state<ExpenseTrend | null>(null)
  let budgetItems = $state<ExpenseBudgetItem[]>([])
  let loading = $state(true)
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
    loading = true
    error = null
    try {
      await refresh()
    } finally {
      loading = false
    }
  }

  // Re-fetches without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the tables and
  // resets scroll position when adding or editing an actual.
  async function refresh() {
    try {
      const [expenses, categoryList, actualList, trendResult, itemList] = await Promise.all([
        listExpenses(),
        listCategories(),
        listExpenseActuals(expenseId),
        getExpenseTrend(expenseId),
        listExpenseBudgetItems(expenseId),
      ])
      expense = expenses.find((e) => e.id === expenseId) ?? null
      categories = categoryList
      actuals = actualList
      trend = trendResult
      budgetItems = itemList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load expense'
    }
  }

  async function handleCategoryChange(value: string) {
    if (!expense) return
    error = null
    try {
      await updateExpense(expense.id, { categoryId: value === '' ? null : Number(value) })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update category'
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

  function cancelEditItem() {
    editingItemId = null
  }

  async function saveItemEdit(item: ExpenseBudgetItem) {
    if (!editItemName.trim() || Number.isNaN(editItemAmount) || editItemAmount === null) {
      error = 'Name and amount are required'
      return
    }
    savingItemEdit = true
    error = null
    try {
      await updateExpenseBudgetItem(item.id, {
        name: editItemName.trim(),
        amount: editItemAmount,
      })
      editingItemId = null
      budgetItems = await listExpenseBudgetItems(expenseId)
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
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handleAdd(event: SubmitEvent) {
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
      await refresh()
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

  function cancelEdit() {
    editingId = null
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
      await refresh()
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
      trend = await getExpenseTrend(expenseId)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }
</script>

<svelte:head>
  <title>{expense ? `${expense.name} · Bookkeeper` : 'Expenses · Bookkeeper'}</title>
</svelte:head>

<a
  href="/expenses"
  class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
>
  ← Expenses
</a>

{#if loading}
  <LoadingIndicator />
{:else if !expense}
  <ErrorMessage message="Expense not found." class="mt-6" />
{:else}
  <h1 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{expense.name}</h1>

  {#if error}
    <ErrorMessage message={error} />
  {/if}

  <div class="mt-4 flex items-center gap-2">
    <span class="text-xs text-slate-400 dark:text-slate-500">Category</span>
    <CategorySelect {categories} value={expense.categoryId} onchange={handleCategoryChange} />
  </div>

  <div class="mt-4 mb-6 flex flex-wrap gap-8">
    <div>
      <span class="block text-xs text-slate-400 dark:text-slate-500">Latest</span>
      <span class="block text-xl font-semibold text-slate-900 dark:text-slate-100">
        {formatCurrency(trend?.latestAmount ?? null)}
      </span>
    </div>
    <div>
      <span class="block text-xs text-slate-400 dark:text-slate-500">12-month average</span>
      <span class="block text-xl font-semibold text-slate-900 dark:text-slate-100">
        {formatCurrency(trend?.average ?? null)}
      </span>
    </div>
    {#if expense.budgetAmount !== null}
      <div>
        <span class="block text-xs text-slate-400 dark:text-slate-500">Budget target</span>
        <span class="block text-xl font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(expense.budgetAmount)}
        </span>
      </div>
    {/if}
    <div>
      <span class="block text-xs text-slate-400 dark:text-slate-500">Trend</span>
      <span class="block text-xl font-semibold">
        <TrendIndicator trend={trend?.trend ?? 'flat'} class="" />
      </span>
    </div>
  </div>

  <h2 class="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Budget breakdown</h2>
  <p class="-mt-2 mb-3 text-sm text-slate-500 dark:text-slate-400">
    What makes up the budget target above, itemized - e.g. insurance, food, grooming for a "Dog"
    expense.
  </p>

  {#if budgetItems.length === 0 && expense.budgetAmount !== null}
    <p
      class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300"
    >
      This expense has a manually-set budget of {formatCurrency(expense.budgetAmount)}. Adding an
      item below will replace it with the sum of your itemized items going forward.
    </p>
  {/if}

  <Card class="sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Item</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each budgetItems as item (item.id)}
          {#if editingItemId === item.id}
            <tr
              class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
            >
              <td class="px-3 py-2 sm:table-cell">
                <input
                  type="text"
                  bind:value={editItemName}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Amount</span
                >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editItemAmount}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                  onclick={cancelEditItem}
                />
              </td>
            </tr>
          {:else}
            <tr
              class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
            >
              <td class="px-3 py-2 font-medium text-slate-900 sm:table-cell dark:text-slate-100"
                >{item.name}</td
              >
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Amount</span
                >
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
              class="block px-3 py-6 text-center text-sm text-slate-400 sm:table-cell dark:text-slate-500"
            >
              No items yet.
            </td>
          </tr>
        {/each}
      </tbody>
      {#if budgetItems.length > 0}
        <tfoot class="block sm:table-footer-group">
          <tr
            class="mt-1 block border-t border-slate-200 pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0 dark:border-slate-700"
          >
            <td class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100">Total</td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Amount</span
              >
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
    class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Item</span>
      <input
        type="text"
        placeholder="e.g. Insurance"
        bind:value={itemName}
        class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={itemAmount}
        class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <Button type="submit" disabled={creatingItem}>
      {creatingItem ? 'Adding…' : 'Add item'}
    </Button>
  </form>

  <h2 class="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
    Monthly actuals
  </h2>
  <Card class="sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Month</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Notes</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each sortedActuals as actual (actual.id)}
          {#if editingId === actual.id}
            <tr
              class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
            >
              <td class="px-3 py-2 sm:table-cell">
                <MonthYearPicker bind:value={editActualMonth} size="table" />
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Amount</span
                >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editAmount}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Notes</span
                >
                <input
                  type="text"
                  bind:value={editNotes}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                  onclick={cancelEdit}
                />
              </td>
            </tr>
          {:else}
            <tr
              class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
            >
              <td class="px-3 py-2 text-slate-700 sm:table-cell dark:text-slate-300">
                {formatMonthYear(actual.occurredOn)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Amount</span
                >
                {formatCurrency(actual.amount)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Notes</span
                >
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
              class="block px-3 py-6 text-center text-sm text-slate-400 sm:table-cell dark:text-slate-500"
            >
              No entries yet.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>

  <form
    onsubmit={handleAdd}
    class="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Month</span>
      <MonthYearPicker bind:value={actualMonth} size="form" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={amount}
        class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Notes</span>
      <input
        type="text"
        bind:value={notes}
        placeholder="optional"
        class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <Button type="submit" disabled={creating}>
      {creating ? 'Adding…' : 'Add entry'}
    </Button>
  </form>
{/if}
