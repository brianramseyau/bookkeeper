<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    type Expense,
  } from '$lib/api/expenses'
  import { getExpenseTrend, type ExpenseTrend } from '$lib/api/expense-actuals'
  import { listCategories, type Category } from '$lib/api/categories'
  import { formatCurrency } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'
  import CategorySelect from '$lib/components/CategorySelect.svelte'
  import {
    mdiPencil,
    mdiCloseThick,
    mdiContentSave,
    mdiPause,
    mdiPlay,
    mdiArchive,
    mdiPackageUp,
    mdiDelete,
    mdiRestore,
  } from '@mdi/js'

  interface Row {
    expense: Expense
    trend: ExpenseTrend | null
  }

  let rows = $state<Row[]>([])
  let categories = $state<Category[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showHidden = $state(false)

  let newName = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editColor = $state('#64748b')
  let editBudgetAmount = $state<number>(NaN)
  let editIncludeInStandardMonth = $state(true)
  let savingEdit = $state(false)
  let reordering = $state(false)

  const activeRows = $derived(
    rows.filter((r) => r.expense.isActive && !r.expense.isPaused && !r.expense.isArchived)
  )
  const pausedRows = $derived(
    rows.filter((r) => r.expense.isActive && r.expense.isPaused && !r.expense.isArchived)
  )
  const archivedRows = $derived(rows.filter((r) => r.expense.isActive && r.expense.isArchived))
  const removedRows = $derived(rows.filter((r) => !r.expense.isActive))

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

  // Re-fetches rows without touching `loading` - toggling `loading` swaps
  // the whole page to a "Loading…" placeholder, which unmounts the table and
  // resets scroll position on every add/edit/pause/archive/reorder action.
  async function refresh() {
    try {
      const [expenses, categoryList] = await Promise.all([
        listExpenses({ includeHidden: true }),
        listCategories(),
      ])
      const trends = await Promise.all(expenses.map((e) => getExpenseTrend(e.id)))
      rows = expenses.map((expense, i) => ({ expense, trend: trends[i] ?? null }))
      categories = categoryList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load expenses'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    creating = true
    error = null
    try {
      await createExpense({ name: newName.trim() })
      newName = ''
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add expense'
    } finally {
      creating = false
    }
  }

  function startEdit(expense: Expense) {
    editingId = expense.id
    editName = expense.name
    editColor = expense.color ?? '#64748b'
    editBudgetAmount = expense.budgetAmount ?? NaN
    editIncludeInStandardMonth = expense.includeInStandardMonth
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(expense: Expense) {
    if (!editName.trim()) {
      error = 'Name is required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateExpense(expense.id, {
        name: editName.trim(),
        color: editColor,
        // Itemized expenses derive their budget from their items (see the
        // expense detail page) - budgetAmount isn't manually editable here.
        ...(expense.budgetItemCount === 0
          ? { budgetAmount: Number.isNaN(editBudgetAmount) ? null : editBudgetAmount }
          : {}),
        includeInStandardMonth: editIncludeInStandardMonth,
      })
      editingId = null
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }

  async function handleRemove(expense: Expense) {
    if (!confirm(`Permanently delete "${expense.name}"? This cannot be undone.`)) return
    error = null
    try {
      await deleteExpense(expense.id)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to remove'
    }
  }

  async function handleCategoryChange(expense: Expense, value: string) {
    error = null
    try {
      await updateExpense(expense.id, { categoryId: value === '' ? null : Number(value) })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update category'
    }
  }

  async function handlePause(expense: Expense) {
    error = null
    try {
      await updateExpense(expense.id, { isPaused: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to pause'
    }
  }

  async function handleUnpause(expense: Expense) {
    error = null
    try {
      await updateExpense(expense.id, { isPaused: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unpause'
    }
  }

  async function handleArchive(expense: Expense) {
    error = null
    try {
      await updateExpense(expense.id, { isArchived: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to archive'
    }
  }

  async function handleUnarchive(expense: Expense) {
    error = null
    try {
      await updateExpense(expense.id, { isArchived: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unarchive'
    }
  }

  async function handleRestore(expense: Expense) {
    error = null
    try {
      await updateExpense(expense.id, { isActive: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to restore'
    }
  }

  async function moveExpense(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= activeRows.length) return

    reordering = true
    error = null
    try {
      const current = activeRows[index]!.expense
      const target = activeRows[targetIndex]!.expense
      await Promise.all([
        updateExpense(current.id, { sortOrder: target.sortOrder }),
        updateExpense(target.id, { sortOrder: current.sortOrder }),
      ])
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reorder'
    } finally {
      reordering = false
    }
  }
</script>

{#snippet editRow(expense: Expense)}
  <tr
    class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
  >
    <td class="px-3 py-2">
      <div class="flex items-center gap-2">
        <input
          type="color"
          bind:value={editColor}
          class="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0 dark:border-slate-600"
        />
        <input
          type="text"
          bind:value={editName}
          class="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
    </td>
    <td class="px-3 py-2">
      <CategorySelect
        {categories}
        value={expense.categoryId}
        variant="table"
        onchange={(value) => handleCategoryChange(expense, value)}
      />
    </td>
    <td class="px-3 py-2 text-right">
      {#if expense.budgetItemCount > 0}
        <span
          class="text-sm text-slate-500 dark:text-slate-400"
          title="Derived from {expense.budgetItemCount} itemized budget line(s) - edit them on the expense page"
        >
          {formatCurrency(expense.budgetAmount)}
        </span>
      {:else}
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="—"
          bind:value={editBudgetAmount}
          class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      {/if}
    </td>
    <td class="px-3 py-2 text-right text-slate-400 dark:text-slate-500">—</td>
    <td class="px-3 py-2 text-right text-slate-400 dark:text-slate-500">—</td>
    <td class="px-3 py-2"></td>
    <td class="px-3 py-2 text-center">
      <input
        type="checkbox"
        bind:checked={editIncludeInStandardMonth}
        class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
      />
    </td>
    <td class="px-3 py-2 text-right whitespace-nowrap">
      <IconActionButton
        variant="primary"
        disabled={savingEdit}
        label="Save {expense.name}"
        path={mdiContentSave}
        onclick={() => saveEdit(expense)}
      />
      <IconActionButton
        variant="cancel"
        label="Cancel editing {expense.name}"
        path={mdiCloseThick}
        onclick={cancelEdit}
      />
    </td>
    <td class="px-3 py-2"></td>
  </tr>
{/snippet}

<PageHead title="Expenses" />

<div class="flex items-center justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Expenses</h1>
  <button
    type="button"
    onclick={() => (showHidden = !showHidden)}
    class="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
  >
    {showHidden ? 'Hide' : 'Show'} paused / archived / removed
  </button>
</div>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else}
  <Card class="mt-6 overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Name</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Category</th
          >
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
            >Monthly</th
          >
          <th class="px-3 py-2"></th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each activeRows as row, index (row.expense.id)}
          {#if editingId === row.expense.id}
            {@render editRow(row.expense)}
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                <a
                  href={`/expenses/${row.expense.id}`}
                  class="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <span
                    class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                    style="background-color: {row.expense.color ?? '#94a3b8'}"
                  ></span>
                  {row.expense.name}
                </a>
              </td>
              <td class="px-3 py-2">
                <CategorySelect
                  {categories}
                  value={row.expense.categoryId}
                  variant="table"
                  onchange={(value) => handleCategoryChange(row.expense, value)}
                />
              </td>
              <td
                class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
                title={row.expense.budgetItemCount > 0
                  ? `Derived from ${row.expense.budgetItemCount} itemized budget line(s)`
                  : undefined}
              >
                {formatCurrency(row.expense.budgetAmount)}
                {#if row.expense.budgetItemCount > 0}
                  <span class="text-slate-400 dark:text-slate-500">*</span>
                {/if}
              </td>
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(row.trend?.latestAmount ?? null)}
              </td>
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                {formatCurrency(row.trend?.average ?? null)}
              </td>
              <td class="px-3 py-2">
                <TrendIndicator trend={row.trend?.trend} class="text-xs font-medium" />
              </td>
              <td class="px-3 py-2 text-center">
                {#if row.expense.includeInStandardMonth}
                  <span class="text-emerald-600 dark:text-emerald-400" title="Included in Monthly"
                    >✓</span
                  >
                {:else}
                  <span class="text-slate-300 dark:text-slate-600" title="Excluded from Monthly"
                    >—</span
                  >
                {/if}
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <IconActionButton
                  variant="neutral"
                  label="Edit {row.expense.name}"
                  path={mdiPencil}
                  onclick={() => startEdit(row.expense)}
                />
                <IconActionButton
                  variant="amber"
                  label="Pause {row.expense.name}"
                  path={mdiPause}
                  onclick={() => handlePause(row.expense)}
                />
                <IconActionButton
                  variant="muted"
                  label="Archive {row.expense.name}"
                  path={mdiArchive}
                  onclick={() => handleArchive(row.expense)}
                />
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => moveExpense(index, -1)}
                  disabled={index === 0 || reordering}
                  aria-label="Move {row.expense.name} up"
                  class="text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onclick={() => moveExpense(index, 1)}
                  disabled={index === activeRows.length - 1 || reordering}
                  aria-label="Move {row.expense.name} down"
                  class="ml-1 text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  ▼
                </button>
              </td>
            </tr>
          {/if}
        {/each}

        {#if showHidden}
          {#if pausedRows.length > 0}
            <tr
              class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="9"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Paused
              </td>
            </tr>
            {#each pausedRows as row (row.expense.id)}
              {#if editingId === row.expense.id}
                {@render editRow(row.expense)}
              {:else}
                <tr
                  class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    <span class="flex items-center">
                      <span
                        class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                        style="background-color: {row.expense.color ?? '#94a3b8'}"
                      ></span>
                      <span class="ml-2">{row.expense.name}</span>
                      <StatusBadge label="Paused" tone="amber" />
                    </span>
                  </td>
                  <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {categories.find((c) => c.id === row.expense.categoryId)?.name ?? ''}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.expense.budgetAmount)}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.trend?.latestAmount ?? null)}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.trend?.average ?? null)}
                  </td>
                  <td class="px-3 py-2"></td>
                  <td
                    class="px-3 py-2 text-center text-slate-300 dark:text-slate-600"
                    title="Excluded from Monthly while paused"
                  >
                    —
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {row.expense.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(row.expense)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unpause {row.expense.name}"
                      path={mdiPlay}
                      onclick={() => handleUnpause(row.expense)}
                    />
                    <IconActionButton
                      variant="muted"
                      label="Archive {row.expense.name}"
                      path={mdiArchive}
                      onclick={() => handleArchive(row.expense)}
                    />
                  </td>
                  <td class="px-3 py-2"></td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if archivedRows.length > 0}
            <tr
              class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="9"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Archived
              </td>
            </tr>
            {#each archivedRows as row (row.expense.id)}
              {#if editingId === row.expense.id}
                {@render editRow(row.expense)}
              {:else}
                <tr
                  class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    <span class="flex items-center">
                      <span
                        class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                        style="background-color: {row.expense.color ?? '#94a3b8'}"
                      ></span>
                      <span class="ml-2">{row.expense.name}</span>
                      <StatusBadge label="Archived" tone="slate" />
                    </span>
                  </td>
                  <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {categories.find((c) => c.id === row.expense.categoryId)?.name ?? ''}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.expense.budgetAmount)}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.trend?.latestAmount ?? null)}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.trend?.average ?? null)}
                  </td>
                  <td class="px-3 py-2"></td>
                  <td
                    class="px-3 py-2 text-center text-slate-300 dark:text-slate-600"
                    title="Excluded from Monthly while archived"
                  >
                    —
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {row.expense.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(row.expense)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unarchive {row.expense.name}"
                      path={mdiPackageUp}
                      onclick={() => handleUnarchive(row.expense)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {row.expense.name}"
                      path={mdiDelete}
                      onclick={() => handleRemove(row.expense)}
                    />
                  </td>
                  <td class="px-3 py-2"></td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if removedRows.length > 0}
            <tr
              class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="9"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Removed
              </td>
            </tr>
            {#each removedRows as row (row.expense.id)}
              <tr
                class="border-b border-slate-100 opacity-60 last:border-0 dark:border-slate-700/60"
              >
                <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                  <span class="flex items-center">
                    <span
                      class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                      style="background-color: {row.expense.color ?? '#94a3b8'}"
                    ></span>
                    <span class="ml-2">{row.expense.name}</span>
                    <StatusBadge label="Removed" tone="slate" />
                  </span>
                </td>
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {categories.find((c) => c.id === row.expense.categoryId)?.name ?? ''}
                </td>
                <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                  {formatCurrency(row.expense.budgetAmount)}
                </td>
                <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                  {formatCurrency(row.trend?.latestAmount ?? null)}
                </td>
                <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                  {formatCurrency(row.trend?.average ?? null)}
                </td>
                <td class="px-3 py-2"></td>
                <td class="px-3 py-2 text-center text-slate-300 dark:text-slate-600">—</td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <IconActionButton
                    variant="success"
                    label="Restore {row.expense.name}"
                    path={mdiRestore}
                    onclick={() => handleRestore(row.expense)}
                  />
                </td>
                <td class="px-3 py-2"></td>
              </tr>
            {/each}
          {/if}
        {/if}
      </tbody>
    </table>
  </Card>

  <form onsubmit={handleAdd} class="mt-6 flex gap-2">
    <input
      type="text"
      placeholder="Add an expense (e.g. Groceries)"
      bind:value={newName}
      class="max-w-xs flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    <PrimaryButton type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add expense'}
    </PrimaryButton>
  </form>
{/if}
