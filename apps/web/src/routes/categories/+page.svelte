<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    type Category,
  } from '$lib/api/categories'
  import { getCategoryTrend, type CategoryTrend } from '$lib/api/category-actuals'
  import { formatCurrency } from '$lib/format'
  import { ApiError } from '$lib/api'

  interface Row {
    category: Category
    trend: CategoryTrend | null
  }

  let rows = $state<Row[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  let newName = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editBudgetAmount = $state<number>(NaN)
  let editIncludeInStandardMonth = $state(true)
  let savingEdit = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const categories = await listCategories()
      const trends = await Promise.all(categories.map((c) => getCategoryTrend(c.id)))
      rows = categories.map((category, i) => ({ category, trend: trends[i] ?? null }))
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load categories'
    } finally {
      loading = false
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    creating = true
    error = null
    try {
      await createCategory({ name: newName.trim() })
      newName = ''
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add category'
    } finally {
      creating = false
    }
  }

  function startEdit(category: Category) {
    editingId = category.id
    editName = category.name
    editBudgetAmount = category.budgetAmount ?? NaN
    editIncludeInStandardMonth = category.includeInStandardMonth
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(category: Category) {
    if (!editName.trim()) {
      error = 'Name is required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateCategory(category.id, {
        name: editName.trim(),
        budgetAmount: Number.isNaN(editBudgetAmount) ? null : editBudgetAmount,
        includeInStandardMonth: editIncludeInStandardMonth,
      })
      editingId = null
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }

  async function handleArchive(category: Category) {
    error = null
    try {
      await deleteCategory(category.id)
      rows = rows.filter((r) => r.category.id !== category.id)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to archive'
    }
  }
</script>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Categories</h1>

{#if error}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else}
  <div
    class="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Name</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Budget</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Latest</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >12-mo avg</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Trend</th
          >
          <th class="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400"
            >Std Month</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.category.id)}
          {#if editingId === row.category.id}
            <tr
              class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
            >
              <td class="px-3 py-2">
                <input
                  type="text"
                  bind:value={editName}
                  class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="—"
                  bind:value={editBudgetAmount}
                  class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right text-slate-400 dark:text-slate-500">—</td>
              <td class="px-3 py-2 text-right text-slate-400 dark:text-slate-500">—</td>
              <td class="px-3 py-2"></td>
              <td class="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  bind:checked={editIncludeInStandardMonth}
                  class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                />
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => saveEdit(row.category)}
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
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                <a
                  href={`/categories/${row.category.id}`}
                  class="hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {row.category.name}
                </a>
              </td>
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                {formatCurrency(row.category.budgetAmount)}
              </td>
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(row.trend?.latestAmount ?? null)}
              </td>
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                {formatCurrency(row.trend?.average ?? null)}
              </td>
              <td class="px-3 py-2">
                {#if row.trend?.trend === 'up'}
                  <span class="text-xs font-medium text-red-600 dark:text-red-400">▲ up</span>
                {:else if row.trend?.trend === 'down'}
                  <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    >▼ down</span
                  >
                {:else if row.trend?.trend === 'flat'}
                  <span class="text-xs font-medium text-slate-400 dark:text-slate-500">— flat</span>
                {/if}
              </td>
              <td class="px-3 py-2 text-center">
                {#if row.category.includeInStandardMonth}
                  <span class="text-emerald-600 dark:text-emerald-400" title="Included in Standard Month">✓</span>
                {:else}
                  <span class="text-slate-300 dark:text-slate-600" title="Excluded from Standard Month">—</span>
                {/if}
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => startEdit(row.category)}
                  class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onclick={() => handleArchive(row.category)}
                  class="ml-2 text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                >
                  Archive
                </button>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <form onsubmit={handleAdd} class="mt-6 flex gap-2">
    <input
      type="text"
      placeholder="Add a category (e.g. Entertainment)"
      bind:value={newName}
      class="max-w-xs flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    <button
      type="submit"
      disabled={creating}
      class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {creating ? 'Adding…' : 'Add category'}
    </button>
  </form>
{/if}
