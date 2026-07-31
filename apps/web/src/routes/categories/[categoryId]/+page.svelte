<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { listCategories, type Category } from '$lib/api/categories'
  import {
    listCategoryActuals,
    getCategoryTrend,
    createCategoryActual,
    updateCategoryActual,
    deleteCategoryActual,
    type CategoryMonthlyActual,
    type CategoryTrend,
  } from '$lib/api/category-actuals'
  import {
    listCategoryBudgetItems,
    createCategoryBudgetItem,
    updateCategoryBudgetItem,
    deleteCategoryBudgetItem,
    type CategoryBudgetItem,
  } from '$lib/api/category-budget-items'
  import { formatCurrency, formatDate } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'
  import { mdiPencil, mdiClose, mdiContentSave, mdiDelete } from '@mdi/js'

  const categoryId = Number(page.params.categoryId)

  let category = $state<Category | null>(null)
  let actuals = $state<CategoryMonthlyActual[]>([])
  let trend = $state<CategoryTrend | null>(null)
  let budgetItems = $state<CategoryBudgetItem[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  let occurredOn = $state('')
  let amount = $state<number>(NaN)
  let notes = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editOccurredOn = $state('')
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
      const [categories, actualList, trendResult, itemList] = await Promise.all([
        listCategories(),
        listCategoryActuals(categoryId),
        getCategoryTrend(categoryId),
        listCategoryBudgetItems(categoryId),
      ])
      category = categories.find((c) => c.id === categoryId) ?? null
      actuals = actualList
      trend = trendResult
      budgetItems = itemList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load category'
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
      await createCategoryBudgetItem(categoryId, { name: itemName.trim(), amount: itemAmount })
      itemName = ''
      itemAmount = NaN
      budgetItems = await listCategoryBudgetItems(categoryId)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add item'
    } finally {
      creatingItem = false
    }
  }

  function startEditItem(item: CategoryBudgetItem) {
    editingItemId = item.id
    editItemName = item.name
    editItemAmount = item.amount
  }

  function cancelEditItem() {
    editingItemId = null
  }

  async function saveItemEdit(item: CategoryBudgetItem) {
    if (!editItemName.trim() || Number.isNaN(editItemAmount) || editItemAmount === null) {
      error = 'Name and amount are required'
      return
    }
    savingItemEdit = true
    error = null
    try {
      await updateCategoryBudgetItem(item.id, {
        name: editItemName.trim(),
        amount: editItemAmount,
      })
      editingItemId = null
      budgetItems = await listCategoryBudgetItems(categoryId)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingItemEdit = false
    }
  }

  async function handleDeleteItem(item: CategoryBudgetItem) {
    error = null
    try {
      await deleteCategoryBudgetItem(item.id)
      budgetItems = budgetItems.filter((i) => i.id !== item.id)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!occurredOn || Number.isNaN(amount) || amount === null) {
      error = 'Date and amount are required'
      return
    }
    creating = true
    error = null
    try {
      await createCategoryActual(categoryId, {
        occurredOn,
        amount,
        notes: notes.trim() === '' ? undefined : notes.trim(),
      })
      occurredOn = ''
      amount = NaN
      notes = ''
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add entry'
    } finally {
      creating = false
    }
  }

  function startEdit(actual: CategoryMonthlyActual) {
    editingId = actual.id
    editOccurredOn = actual.occurredOn.slice(0, 10)
    editAmount = actual.amount
    editNotes = actual.notes ?? ''
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(actual: CategoryMonthlyActual) {
    if (!editOccurredOn || Number.isNaN(editAmount) || editAmount === null) {
      error = 'Date and amount are required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateCategoryActual(actual.id, {
        occurredOn: editOccurredOn,
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

  async function handleDelete(actual: CategoryMonthlyActual) {
    error = null
    try {
      await deleteCategoryActual(actual.id)
      actuals = actuals.filter((a) => a.id !== actual.id)
      trend = await getCategoryTrend(categoryId)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }
</script>

<svelte:head>
  <title>{category ? `${category.name} · Bookkeeper` : 'Categories · Bookkeeper'}</title>
</svelte:head>

<a
  href="/categories"
  class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
>
  ← Categories
</a>

{#if loading}
  <LoadingIndicator />
{:else if !category}
  <ErrorMessage message="Category not found." class="mt-6" />
{:else}
  <h1 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{category.name}</h1>

  {#if error}
    <ErrorMessage message={error} />
  {/if}

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
    {#if category.budgetAmount !== null}
      <div>
        <span class="block text-xs text-slate-400 dark:text-slate-500">Budget target</span>
        <span class="block text-xl font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(category.budgetAmount)}
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
    category.
  </p>

  {#if budgetItems.length === 0 && category.budgetAmount !== null}
    <p
      class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300"
    >
      This category has a manually-set budget of {formatCurrency(category.budgetAmount)}. Adding an
      item below will replace it with the sum of your itemized items going forward.
    </p>
  {/if}

  <Card class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Item</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each budgetItems as item (item.id)}
          {#if editingItemId === item.id}
            <tr
              class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
            >
              <td class="px-3 py-2">
                <input
                  type="text"
                  bind:value={editItemName}
                  class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editItemAmount}
                  class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
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
                  path={mdiClose}
                  onclick={cancelEditItem}
                />
              </td>
            </tr>
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(item.amount)}
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
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
          <tr>
            <td
              colspan="3"
              class="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500"
            >
              No items yet.
            </td>
          </tr>
        {/each}
      </tbody>
      {#if budgetItems.length > 0}
        <tfoot>
          <tr class="border-t border-slate-200 font-semibold dark:border-slate-700">
            <td class="px-3 py-2 text-slate-900 dark:text-slate-100">Total</td>
            <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
              {formatCurrency(budgetItemsTotal)}
            </td>
            <td class="px-3 py-2"></td>
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
    <PrimaryButton type="submit" disabled={creatingItem}>
      {creatingItem ? 'Adding…' : 'Add item'}
    </PrimaryButton>
  </form>

  <h2 class="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
    Monthly actuals
  </h2>
  <Card class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Notes</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedActuals as actual (actual.id)}
          {#if editingId === actual.id}
            <tr
              class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
            >
              <td class="px-3 py-2">
                <input
                  type="date"
                  bind:value={editOccurredOn}
                  class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editAmount}
                  class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2">
                <input
                  type="text"
                  bind:value={editNotes}
                  class="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <IconActionButton
                  variant="primary"
                  disabled={savingEdit}
                  label="Save entry from {formatDate(actual.occurredOn)}"
                  path={mdiContentSave}
                  onclick={() => saveEdit(actual)}
                />
                <IconActionButton
                  variant="cancel"
                  label="Cancel editing entry from {formatDate(actual.occurredOn)}"
                  path={mdiClose}
                  onclick={cancelEdit}
                />
              </td>
            </tr>
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 text-slate-700 dark:text-slate-300">
                {formatDate(actual.occurredOn)}
              </td>
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(actual.amount)}
              </td>
              <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{actual.notes ?? ''}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <IconActionButton
                  variant="neutral"
                  label="Edit entry from {formatDate(actual.occurredOn)}"
                  path={mdiPencil}
                  onclick={() => startEdit(actual)}
                />
                <IconActionButton
                  variant="danger"
                  label="Delete entry from {formatDate(actual.occurredOn)}"
                  path={mdiDelete}
                  onclick={() => handleDelete(actual)}
                />
              </td>
            </tr>
          {/if}
        {:else}
          <tr>
            <td
              colspan="4"
              class="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500"
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
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Date</span>
      <input
        type="date"
        bind:value={occurredOn}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
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
    <PrimaryButton type="submit" disabled={creating}>
      {creating ? 'Adding…' : 'Add entry'}
    </PrimaryButton>
  </form>
{/if}
