<script lang="ts">
  import { onMount } from 'svelte'
  import { dragHandleZone, type DndEvent } from 'svelte-dnd-action'
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
  import { reorderedSortOrders } from '$lib/dnd'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'
  import CategorySelect from '$lib/components/CategorySelect.svelte'
  import DragHandle from '$lib/components/DragHandle.svelte'
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

  // svelte-dnd-action identifies items by an `id` field on the item itself -
  // add one on top of Row (whose real identity is nested at `expense.id`).
  interface DndRow extends Row {
    id: number
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
  let editBudgetAmount = $state<number>(NaN)
  let editIsRecurring = $state(true)
  let editExcludeFromBudget = $state(false)
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

  // Local, drag-reorderable copy of the active rows - synced from the
  // derived list above, then temporarily diverges during a drag so the
  // dndzone can preview the new order before it's persisted.
  let orderedActive = $state<DndRow[]>([])
  $effect(() => {
    orderedActive = activeRows.map((row) => ({ ...row, id: row.expense.id }))
  })

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
    editBudgetAmount = expense.budgetAmount ?? NaN
    editIsRecurring = expense.isRecurring
    editExcludeFromBudget = expense.excludeFromBudget
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
        // Itemized expenses derive their budget from their items (see the
        // expense detail page) - budgetAmount isn't manually editable here.
        ...(expense.budgetItemCount === 0
          ? { budgetAmount: Number.isNaN(editBudgetAmount) ? null : editBudgetAmount }
          : {}),
        isRecurring: editIsRecurring,
        excludeFromBudget: editExcludeFromBudget,
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

  function considerActive(e: CustomEvent<DndEvent<DndRow>>) {
    orderedActive = e.detail.items
  }

  async function finalizeActive(e: CustomEvent<DndEvent<DndRow>>) {
    orderedActive = e.detail.items

    const updates = reorderedSortOrders(e.detail.items.map((row) => row.expense))
    if (updates.length === 0) return

    reordering = true
    error = null
    try {
      await Promise.all(updates.map((u) => updateExpense(u.id, { sortOrder: u.sortOrder })))
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reorder'
    } finally {
      reordering = false
    }
  }

  // The under-name status line (view mode only) - category plus any
  // non-default Recurring/Ignore-budget state. Default states (Recurring on,
  // Ignore budget off) aren't shown - only deviations from the default are
  // worth calling out here.
  function statusLineParts(expense: Expense): string[] {
    const categoryName = categories.find((c) => c.id === expense.categoryId)?.name
    return [
      categoryName,
      expense.isRecurring ? null : 'adhoc expense',
      expense.excludeFromBudget ? 'ignored from budget' : null,
    ].filter((part): part is string => Boolean(part))
  }
</script>

{#snippet statusLine(expense: Expense)}
  {@const parts = statusLineParts(expense)}
  {#if parts.length > 0}
    <p class="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
      {parts.join(' · ')}
    </p>
  {/if}
{/snippet}

{#snippet editRow(expense: Expense)}
  <tr
    class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
  >
    <td class="hidden px-3 py-2 sm:table-cell"></td>
    <td class="px-3 py-2 sm:table-cell">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <input
            type="text"
            bind:value={editName}
            class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <CategorySelect
            {categories}
            value={expense.categoryId}
            variant="table"
            onchange={(value) => handleCategoryChange(expense, value)}
          />
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <label class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                bind:checked={editIsRecurring}
                class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
              />
              Recurring
            </label>
            <label class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                bind:checked={editExcludeFromBudget}
                class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
              />
              Ignore budget
            </label>
          </div>
        </div>
        <span class="flex shrink-0 items-center gap-1 sm:hidden">
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
        </span>
      </div>
    </td>
    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right">
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Budget</span
      >
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
          class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      {/if}
    </td>
    <td
      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
    >
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Latest</span
      >
      —
    </td>
    <td
      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
    >
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >12-mo avg</span
      >
      —
    </td>
    <td class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right">
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
  <Card class="mt-6 sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2"></th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Name</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Budget</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Latest</th
          >
          <th
            class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            title="12-month rolling average, with a caret showing whether that average is trending up or down."
            >12-mo avg</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody
        class="block sm:table-row-group"
        use:dragHandleZone={{ items: orderedActive, flipDurationMs: 150, dragDisabled: reordering }}
        onconsider={considerActive}
        onfinalize={finalizeActive}
      >
        {#each orderedActive as row (row.id)}
          {#if editingId === row.expense.id}
            {@render editRow(row.expense)}
          {:else}
            <tr
              class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
            >
              <td class="hidden px-3 py-2 text-center sm:table-cell">
                <DragHandle label="Move {row.expense.name}" />
              </td>
              <td
                class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <span class="shrink-0 sm:hidden">
                    <DragHandle label="Move {row.expense.name}" />
                  </span>
                  <span class="min-w-0">
                    <a
                      href={`/expenses/${row.expense.id}`}
                      class="block truncate hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {row.expense.name}
                    </a>
                    {@render statusLine(row.expense)}
                  </span>
                </span>
                <span class="flex shrink-0 items-center gap-1 sm:hidden">
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
                </span>
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
                title={row.expense.budgetItemCount > 0
                  ? `Derived from ${row.expense.budgetItemCount} itemized budget line(s)`
                  : undefined}
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Budget</span
                >
                <span>
                  {formatCurrency(row.expense.budgetAmount)}
                  {#if row.expense.budgetItemCount > 0}
                    <span class="text-slate-400 dark:text-slate-500">*</span>
                  {/if}
                </span>
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Latest</span
                >
                {formatCurrency(row.trend?.latestAmount ?? null)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >12-mo avg</span
                >
                <span class="inline-flex items-center gap-1.5">
                  <span>{formatCurrency(row.trend?.average ?? null)}</span>
                  <TrendIndicator trend={row.trend?.trend} caretOnly class="text-sm font-medium" />
                </span>
              </td>
              <td class="hidden justify-end px-3 py-2 sm:table-cell sm:text-right">
                <ActionMenu
                  label="Actions for {row.expense.name}"
                  actions={[
                    {
                      label: 'Edit',
                      path: mdiPencil,
                      variant: 'neutral',
                      onclick: () => startEdit(row.expense),
                    },
                    {
                      label: 'Pause',
                      path: mdiPause,
                      variant: 'amber',
                      onclick: () => handlePause(row.expense),
                    },
                    {
                      label: 'Archive',
                      path: mdiArchive,
                      variant: 'muted',
                      onclick: () => handleArchive(row.expense),
                    },
                  ]}
                />
              </td>
            </tr>
          {/if}
        {/each}

        {#if showHidden}
          {#if pausedRows.length > 0}
            <tr
              class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="6"
                class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
              >
                Paused
              </td>
            </tr>
            {#each pausedRows as row (row.expense.id)}
              {#if editingId === row.expense.id}
                {@render editRow(row.expense)}
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white opacity-70 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
                >
                  <td class="hidden px-3 py-2 sm:table-cell"></td>
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                  >
                    <span class="flex min-w-0 items-center">
                      <span class="min-w-0">
                        <span class="flex items-center">
                          <span class="truncate">{row.expense.name}</span>
                          <StatusBadge label="Paused" tone="amber" />
                        </span>
                        {@render statusLine(row.expense)}
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
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
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Budget</span
                    >
                    {formatCurrency(row.expense.budgetAmount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Latest</span
                    >
                    {formatCurrency(row.trend?.latestAmount ?? null)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >12-mo avg</span
                    >
                    {formatCurrency(row.trend?.average ?? null)}
                  </td>
                  <td class="hidden justify-end px-3 py-2 sm:table-cell sm:text-right">
                    <ActionMenu
                      label="Actions for {row.expense.name}"
                      actions={[
                        {
                          label: 'Edit',
                          path: mdiPencil,
                          variant: 'neutral',
                          onclick: () => startEdit(row.expense),
                        },
                        {
                          label: 'Unpause',
                          path: mdiPlay,
                          variant: 'success',
                          onclick: () => handleUnpause(row.expense),
                        },
                        {
                          label: 'Archive',
                          path: mdiArchive,
                          variant: 'muted',
                          onclick: () => handleArchive(row.expense),
                        },
                      ]}
                    />
                  </td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if archivedRows.length > 0}
            <tr
              class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="6"
                class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
              >
                Archived
              </td>
            </tr>
            {#each archivedRows as row (row.expense.id)}
              {#if editingId === row.expense.id}
                {@render editRow(row.expense)}
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white opacity-70 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
                >
                  <td class="hidden px-3 py-2 sm:table-cell"></td>
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                  >
                    <span class="flex min-w-0 items-center">
                      <span class="min-w-0">
                        <span class="flex items-center">
                          <span class="truncate">{row.expense.name}</span>
                          <StatusBadge label="Archived" tone="slate" />
                        </span>
                        {@render statusLine(row.expense)}
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
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
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Budget</span
                    >
                    {formatCurrency(row.expense.budgetAmount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Latest</span
                    >
                    {formatCurrency(row.trend?.latestAmount ?? null)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >12-mo avg</span
                    >
                    {formatCurrency(row.trend?.average ?? null)}
                  </td>
                  <td class="hidden justify-end px-3 py-2 sm:table-cell sm:text-right">
                    <ActionMenu
                      label="Actions for {row.expense.name}"
                      actions={[
                        {
                          label: 'Edit',
                          path: mdiPencil,
                          variant: 'neutral',
                          onclick: () => startEdit(row.expense),
                        },
                        {
                          label: 'Unarchive',
                          path: mdiPackageUp,
                          variant: 'success',
                          onclick: () => handleUnarchive(row.expense),
                        },
                        {
                          label: 'Delete',
                          path: mdiDelete,
                          variant: 'danger',
                          onclick: () => handleRemove(row.expense),
                        },
                      ]}
                    />
                  </td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if removedRows.length > 0}
            <tr
              class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="6"
                class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
              >
                Removed
              </td>
            </tr>
            {#each removedRows as row (row.expense.id)}
              <tr
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white opacity-60 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
              >
                <td class="hidden px-3 py-2 sm:table-cell"></td>
                <td
                  class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                >
                  <span class="flex min-w-0 items-center">
                    <span class="min-w-0">
                      <span class="flex items-center">
                        <span class="truncate">{row.expense.name}</span>
                        <StatusBadge label="Removed" tone="slate" />
                      </span>
                      {@render statusLine(row.expense)}
                    </span>
                  </span>
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="success"
                      label="Restore {row.expense.name}"
                      path={mdiRestore}
                      onclick={() => handleRestore(row.expense)}
                    />
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Budget</span
                  >
                  {formatCurrency(row.expense.budgetAmount)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Latest</span
                  >
                  {formatCurrency(row.trend?.latestAmount ?? null)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >12-mo avg</span
                  >
                  {formatCurrency(row.trend?.average ?? null)}
                </td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="success"
                    label="Restore {row.expense.name}"
                    path={mdiRestore}
                    onclick={() => handleRestore(row.expense)}
                  />
                </td>
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
    <Button type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add expense'}
    </Button>
  </form>
{/if}
