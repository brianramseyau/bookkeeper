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
  import { formatCurrency, formatDate } from '$lib/format'
  import { ApiError } from '$lib/api'

  const categoryId = Number(page.params.categoryId)

  let category = $state<Category | null>(null)
  let actuals = $state<CategoryMonthlyActual[]>([])
  let trend = $state<CategoryTrend | null>(null)
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

  const sortedActuals = $derived(
    [...actuals].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
  )

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [categories, actualList, trendResult] = await Promise.all([
        listCategories(),
        listCategoryActuals(categoryId),
        getCategoryTrend(categoryId),
      ])
      category = categories.find((c) => c.id === categoryId) ?? null
      actuals = actualList
      trend = trendResult
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load category'
    } finally {
      loading = false
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!occurredOn || Number.isNaN(amount)) {
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
      await load()
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
    if (!editOccurredOn || Number.isNaN(editAmount)) {
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
      await load()
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

<a
  href="/categories"
  class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
>
  ← Categories
</a>

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else if !category}
  <p class="mt-6 text-sm text-red-600 dark:text-red-400">Category not found.</p>
{:else}
  <h1 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{category.name}</h1>

  {#if error}
    <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
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
        {#if trend?.trend === 'up'}
          <span class="text-red-600 dark:text-red-400">▲ up</span>
        {:else if trend?.trend === 'down'}
          <span class="text-emerald-600 dark:text-emerald-400">▼ down</span>
        {:else}
          <span class="text-slate-400 dark:text-slate-500">— flat</span>
        {/if}
      </span>
    </div>
  </div>

  <div
    class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
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
                <button
                  type="button"
                  onclick={() => saveEdit(actual)}
                  disabled={savingEdit}
                  class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Save
                </button>
                <button
                  type="button"
                  onclick={cancelEdit}
                  class="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
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
                <button
                  type="button"
                  onclick={() => startEdit(actual)}
                  class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onclick={() => handleDelete(actual)}
                  class="ml-2 text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
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
  </div>

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
    <button
      type="submit"
      disabled={creating}
      class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {creating ? 'Adding…' : 'Add entry'}
    </button>
  </form>
{/if}
