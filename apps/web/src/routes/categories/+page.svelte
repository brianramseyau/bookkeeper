<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    type Category,
  } from '$lib/api/categories'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import {
    mdiPencil,
    mdiCloseThick,
    mdiContentSave,
    mdiArchive,
    mdiPackageUp,
    mdiDelete,
    mdiRestore,
  } from '@mdi/js'

  let categories = $state<Category[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showHidden = $state(false)

  let newName = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editColor = $state('#64748b')
  let savingEdit = $state(false)
  let reordering = $state(false)

  const activeCategories = $derived(categories.filter((c) => c.isActive && !c.isArchived))
  const archivedCategories = $derived(categories.filter((c) => c.isActive && c.isArchived))
  const removedCategories = $derived(categories.filter((c) => !c.isActive))

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
  // whole page to a "Loading…" placeholder, which unmounts the table and
  // resets scroll position on every add/edit/archive/reorder action.
  async function refresh() {
    try {
      categories = await listCategories({ includeHidden: true })
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
        // The system category can't be renamed - only its color/sortOrder.
        ...(category.isSystem ? {} : { name: editName.trim() }),
        color: editColor,
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
    if (targetIndex < 0 || targetIndex >= activeCategories.length) return

    reordering = true
    error = null
    try {
      const current = activeCategories[index]!
      const target = activeCategories[targetIndex]!
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
        {#if category.isSystem}
          <span class="text-sm text-slate-500 dark:text-slate-400">{category.name}</span>
        {:else}
          <input
            type="text"
            bind:value={editName}
            class="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        {/if}
      </div>
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
    {showHidden ? 'Hide' : 'Show'} archived / removed
  </button>
</div>

<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Tags for bucketing bills, subscriptions, and expenses - useful for reporting later. They don't
  track spend or budget themselves; see <a
    href="/expenses"
    class="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
    >Expenses</a
  > for that.
</p>

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
          <th class="px-3 py-2"></th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each activeCategories as category, index (category.id)}
          {#if editingId === category.id}
            {@render editRow(category)}
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                <span class="flex items-center gap-2">
                  <span
                    class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                    style="background-color: {category.color ?? '#94a3b8'}"
                  ></span>
                  {category.name}
                  {#if category.isSystem}
                    <StatusBadge label="System" tone="slate" />
                  {/if}
                </span>
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <IconActionButton
                  variant="neutral"
                  label="Edit {category.name}"
                  path={mdiPencil}
                  onclick={() => startEdit(category)}
                />
                {#if !category.isSystem}
                  <IconActionButton
                    variant="muted"
                    label="Archive {category.name}"
                    path={mdiArchive}
                    onclick={() => handleArchive(category)}
                  />
                {/if}
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => moveCategory(index, -1)}
                  disabled={index === 0 || reordering}
                  aria-label="Move {category.name} up"
                  class="text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onclick={() => moveCategory(index, 1)}
                  disabled={index === activeCategories.length - 1 || reordering}
                  aria-label="Move {category.name} down"
                  class="ml-1 text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  ▼
                </button>
              </td>
            </tr>
          {/if}
        {/each}

        {#if showHidden}
          {#if archivedCategories.length > 0}
            <tr
              class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="3"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Archived
              </td>
            </tr>
            {#each archivedCategories as category (category.id)}
              {#if editingId === category.id}
                {@render editRow(category)}
              {:else}
                <tr
                  class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    <span class="flex items-center">
                      <span
                        class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                        style="background-color: {category.color ?? '#94a3b8'}"
                      ></span>
                      <span class="ml-2">{category.name}</span>
                      <StatusBadge label="Archived" tone="slate" />
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {category.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(category)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unarchive {category.name}"
                      path={mdiPackageUp}
                      onclick={() => handleUnarchive(category)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {category.name}"
                      path={mdiDelete}
                      onclick={() => handleRemove(category)}
                    />
                  </td>
                  <td class="px-3 py-2"></td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if removedCategories.length > 0}
            <tr
              class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="3"
                class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
              >
                Removed
              </td>
            </tr>
            {#each removedCategories as category (category.id)}
              <tr
                class="border-b border-slate-100 opacity-60 last:border-0 dark:border-slate-700/60"
              >
                <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                  <span class="flex items-center">
                    <span
                      class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                      style="background-color: {category.color ?? '#94a3b8'}"
                    ></span>
                    <span class="ml-2">{category.name}</span>
                    <StatusBadge label="Removed" tone="slate" />
                  </span>
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <IconActionButton
                    variant="success"
                    label="Restore {category.name}"
                    path={mdiRestore}
                    onclick={() => handleRestore(category)}
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
      placeholder="Add a category (e.g. Household)"
      bind:value={newName}
      class="max-w-xs flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    <PrimaryButton type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add category'}
    </PrimaryButton>
  </form>
{/if}
