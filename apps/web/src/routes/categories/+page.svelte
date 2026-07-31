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
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'
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
    category: Category
    trend: CategoryTrend | null
  }

  let rows = $state<Row[]>([])
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
    rows.filter((r) => r.category.isActive && !r.category.isPaused && !r.category.isArchived)
  )
  const pausedRows = $derived(
    rows.filter((r) => r.category.isActive && r.category.isPaused && !r.category.isArchived)
  )
  const archivedRows = $derived(rows.filter((r) => r.category.isActive && r.category.isArchived))
  const removedRows = $derived(rows.filter((r) => !r.category.isActive))

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
      const categories = await listCategories({ includeHidden: true })
      const trends = await Promise.all(categories.map((c) => getCategoryTrend(c.id)))
      rows = categories.map((category, i) => ({ category, trend: trends[i] ?? null }))
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load categories'
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
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add category'
    } finally {
      creating = false
    }
  }

  function startEdit(category: Category) {
    editingId = category.id
    editName = category.name
    editColor = category.color ?? '#64748b'
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
        color: editColor,
        // Itemized categories derive their budget from their items (see the
        // category detail page) - budgetAmount isn't manually editable here.
        ...(category.budgetItemCount === 0
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

  async function handleRemove(category: Category) {
    if (!confirm(`Permanently delete "${category.name}"? This cannot be undone.`)) return
    error = null
    try {
      await deleteCategory(category.id)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to remove'
    }
  }

  async function handlePause(category: Category) {
    error = null
    try {
      await updateCategory(category.id, { isPaused: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to pause'
    }
  }

  async function handleUnpause(category: Category) {
    error = null
    try {
      await updateCategory(category.id, { isPaused: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unpause'
    }
  }

  async function handleArchive(category: Category) {
    error = null
    try {
      await updateCategory(category.id, { isArchived: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to archive'
    }
  }

  async function handleUnarchive(category: Category) {
    error = null
    try {
      await updateCategory(category.id, { isArchived: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unarchive'
    }
  }

  async function handleRestore(category: Category) {
    error = null
    try {
      await updateCategory(category.id, { isActive: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to restore'
    }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= activeRows.length) return

    reordering = true
    error = null
    try {
      const current = activeRows[index]!.category
      const target = activeRows[targetIndex]!.category
      await Promise.all([
        updateCategory(current.id, { sortOrder: target.sortOrder }),
        updateCategory(target.id, { sortOrder: current.sortOrder }),
      ])
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reorder'
    } finally {
      reordering = false
    }
  }
</script>

{#snippet editRow(category: Category)}
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
    <td class="px-3 py-2 text-right">
      {#if category.budgetItemCount > 0}
        <span
          class="text-sm text-slate-500 dark:text-slate-400"
          title="Derived from {category.budgetItemCount} itemized budget line(s) - edit them on the category page"
        >
          {formatCurrency(category.budgetAmount)}
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
        label="Save {category.name}"
        path={mdiContentSave}
        onclick={() => saveEdit(category)}
      />
      <IconActionButton
        variant="cancel"
        label="Cancel editing {category.name}"
        path={mdiCloseThick}
        onclick={cancelEdit}
      />
    </td>
    <td class="px-3 py-2"></td>
  </tr>
{/snippet}

<PageHead title="Categories" />

<div class="flex items-center justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Categories</h1>
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
        {#each activeRows as row, index (row.category.id)}
          {#if editingId === row.category.id}
            {@render editRow(row.category)}
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                <a
                  href={`/categories/${row.category.id}`}
                  class="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <span
                    class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                    style="background-color: {row.category.color ?? '#94a3b8'}"
                  ></span>
                  {row.category.name}
                </a>
              </td>
              <td
                class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
                title={row.category.budgetItemCount > 0
                  ? `Derived from ${row.category.budgetItemCount} itemized budget line(s)`
                  : undefined}
              >
                {formatCurrency(row.category.budgetAmount)}
                {#if row.category.budgetItemCount > 0}
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
                {#if row.category.includeInStandardMonth}
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
                  label="Edit {row.category.name}"
                  path={mdiPencil}
                  onclick={() => startEdit(row.category)}
                />
                <IconActionButton
                  variant="amber"
                  label="Pause {row.category.name}"
                  path={mdiPause}
                  onclick={() => handlePause(row.category)}
                />
                <IconActionButton
                  variant="muted"
                  label="Archive {row.category.name}"
                  path={mdiArchive}
                  onclick={() => handleArchive(row.category)}
                />
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => moveCategory(index, -1)}
                  disabled={index === 0 || reordering}
                  aria-label="Move {row.category.name} up"
                  class="text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onclick={() => moveCategory(index, 1)}
                  disabled={index === activeRows.length - 1 || reordering}
                  aria-label="Move {row.category.name} down"
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
                colspan="8"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Paused
              </td>
            </tr>
            {#each pausedRows as row (row.category.id)}
              {#if editingId === row.category.id}
                {@render editRow(row.category)}
              {:else}
                <tr
                  class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    <span class="flex items-center">
                      <span
                        class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                        style="background-color: {row.category.color ?? '#94a3b8'}"
                      ></span>
                      <span class="ml-2">{row.category.name}</span>
                      <StatusBadge label="Paused" tone="amber" />
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.category.budgetAmount)}
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
                      label="Edit {row.category.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(row.category)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unpause {row.category.name}"
                      path={mdiPlay}
                      onclick={() => handleUnpause(row.category)}
                    />
                    <IconActionButton
                      variant="muted"
                      label="Archive {row.category.name}"
                      path={mdiArchive}
                      onclick={() => handleArchive(row.category)}
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
                colspan="8"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Archived
              </td>
            </tr>
            {#each archivedRows as row (row.category.id)}
              {#if editingId === row.category.id}
                {@render editRow(row.category)}
              {:else}
                <tr
                  class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    <span class="flex items-center">
                      <span
                        class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                        style="background-color: {row.category.color ?? '#94a3b8'}"
                      ></span>
                      <span class="ml-2">{row.category.name}</span>
                      <StatusBadge label="Archived" tone="slate" />
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(row.category.budgetAmount)}
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
                      label="Edit {row.category.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(row.category)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unarchive {row.category.name}"
                      path={mdiPackageUp}
                      onclick={() => handleUnarchive(row.category)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {row.category.name}"
                      path={mdiDelete}
                      onclick={() => handleRemove(row.category)}
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
                colspan="8"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Removed
              </td>
            </tr>
            {#each removedRows as row (row.category.id)}
              <tr
                class="border-b border-slate-100 opacity-60 last:border-0 dark:border-slate-700/60"
              >
                <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                  <span class="flex items-center">
                    <span
                      class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                      style="background-color: {row.category.color ?? '#94a3b8'}"
                    ></span>
                    <span class="ml-2">{row.category.name}</span>
                    <StatusBadge label="Removed" tone="slate" />
                  </span>
                </td>
                <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                  {formatCurrency(row.category.budgetAmount)}
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
                    label="Restore {row.category.name}"
                    path={mdiRestore}
                    onclick={() => handleRestore(row.category)}
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
      placeholder="Add a category (e.g. Entertainment)"
      bind:value={newName}
      class="max-w-xs flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    <PrimaryButton type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add category'}
    </PrimaryButton>
  </form>
{/if}
