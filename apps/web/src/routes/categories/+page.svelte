<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    type Category,
  } from '$lib/api/categories'
  import { reorderedSortOrders } from '$lib/dnd'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import CategoryTree from '$lib/components/CategoryTree.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import {
    mdiPencil,
    mdiCloseThick,
    mdiContentSave,
    mdiPackageUp,
    mdiDelete,
    mdiRestore,
  } from '@mdi/js'

  let categories = $state<Category[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showHidden = $state(false)

  let newName = $state('')
  let newParentId = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editColor = $state('#64748b')
  let editParentId = $state('')
  let savingEdit = $state(false)
  let reordering = $state(false)

  /** Parent ids currently collapsed - empty means everything is open. */
  let collapsedIds = $state<Set<number>>(new Set())

  const archivedCategories = $derived(categories.filter((c) => c.isActive && c.isArchived))
  const removedCategories = $derived(categories.filter((c) => !c.isActive))

  /** Active children grouped by their parent's id, each group sorted in place. */
  function buildChildrenMap(cats: Category[]): Record<number, Category[]> {
    const map: Record<number, Category[]> = {}
    for (const c of cats) {
      if (c.isActive && !c.isArchived && c.parentId !== null) {
        ;(map[c.parentId] ??= []).push(c)
      }
    }
    for (const key of Object.keys(map)) {
      map[Number(key)].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }

  /**
   * Top-level rows are categories with no parent, plus any whose parent isn't
   * active (e.g. parent archived/removed) so they can't vanish silently.
   */
  function buildTopLevel(cats: Category[]): Category[] {
    const active = cats.filter((c) => c.isActive && !c.isArchived)
    const ids = new Set(active.map((c) => c.id))
    return active
      .filter((c) => c.parentId === null || !ids.has(c.parentId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // Local, drag-reorderable copies of each sibling group - synced from
  // `categories` after every fetch, then temporarily diverging during a drag
  // so the dnd zones can preview the new order before it's persisted.
  let orderedNonSystem = $state<Category[]>([])
  let orderedSystem = $state<Category[]>([])
  let orderedChildren = $state<Record<number, Category[]>>({})
  $effect(() => {
    const topLevel = buildTopLevel(categories)
    orderedNonSystem = topLevel.filter((c) => !c.isSystem)
    orderedSystem = topLevel.filter((c) => c.isSystem)
    orderedChildren = buildChildrenMap(categories)
  })

  const nestedParentIds = $derived(new Set(Object.keys(orderedChildren).map(Number)))
  const allExpanded = $derived([...nestedParentIds].every((id) => !collapsedIds.has(id)))

  /** Top-level categories offered as parents (excludes the row being edited). */
  const parentOptions = $derived.by(() => {
    const options = buildTopLevel(categories).filter((c) => c.id !== editingId)
    if (editingId !== null) {
      const editing = categories.find((c) => c.id === editingId)
      const currentParent =
        editing?.parentId != null ? categories.find((c) => c.id === editing.parentId) : undefined
      if (currentParent && !options.some((c) => c.id === currentParent.id)) {
        options.push(currentParent)
      }
    }
    return options
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

  // Re-fetches without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the tree and
  // resets scroll position on every add/edit/archive/reorder action.
  async function refresh() {
    try {
      categories = await listCategories({ includeHidden: true })
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load categories'
    }
  }

  function toggleCollapse(id: number) {
    const next = new Set(collapsedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsedIds = next
  }

  function toggleAll() {
    collapsedIds = allExpanded ? new Set(nestedParentIds) : new Set()
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    creating = true
    error = null
    try {
      await createCategory({
        name: newName.trim(),
        ...(newParentId === '' ? {} : { parentId: Number(newParentId) }),
      })
      newName = ''
      newParentId = ''
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
    editParentId = category.parentId === null ? '' : String(category.parentId)
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
      const newParent = editParentId === '' ? null : Number(editParentId)
      await updateCategory(category.id, {
        // The system category can't be renamed - only its color/sortOrder.
        ...(category.isSystem ? {} : { name: editName.trim() }),
        color: editColor,
        // Only send the parent when it actually changed, so a no-op edit of a
        // top-level category doesn't churn the payload.
        ...(category.parentId !== newParent ? { parentId: newParent } : {}),
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

  function reorderNonSystem(items: Category[], finalize = false) {
    orderedNonSystem = items
    if (finalize) void persistReorder(items)
  }

  function reorderSystem(items: Category[], finalize = false) {
    orderedSystem = items
    if (finalize) void persistReorder(items)
  }

  function reorderChildren(parentId: number, items: Category[], finalize = false) {
    orderedChildren = { ...orderedChildren, [parentId]: items }
    if (finalize) void persistReorder(items)
  }

  async function persistReorder(items: Category[]) {
    const updates = reorderedSortOrders(items)
    if (updates.length === 0) return

    reordering = true
    error = null
    try {
      await Promise.all(updates.map((u) => updateCategory(u.id, { sortOrder: u.sortOrder })))
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reorder'
    } finally {
      reordering = false
    }
  }

  function parentName(id: number | null): string | null {
    if (id === null) return null
    return categories.find((c) => c.id === id)?.name ?? null
  }
</script>

{#snippet hiddenEditRow(category: Category)}
  <div
    class="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-indigo-50/40 px-3 py-1.5 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
  >
    <span class="w-6 shrink-0"></span>
    <input
      type="color"
      bind:value={editColor}
      class="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0 dark:border-slate-600"
    />
    <input
      type="text"
      bind:value={editName}
      class="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
    <select
      bind:value={editParentId}
      aria-label="Parent for {category.name}"
      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <option value="">Top level</option>
      {#each parentOptions as parent (parent.id)}
        <option value={String(parent.id)}>{parent.name}</option>
      {/each}
    </select>
    <div class="ml-auto flex shrink-0 items-center gap-1">
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
    </div>
  </div>
{/snippet}

<PageHead title="Categories" />

<div class="flex items-center justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Categories</h1>
  <div class="flex items-center gap-4">
    {#if nestedParentIds.size > 0}
      <button
        type="button"
        onclick={toggleAll}
        class="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        {allExpanded ? 'Unfold less' : 'Unfold more'}
      </button>
    {/if}
    <button
      type="button"
      onclick={() => (showHidden = !showHidden)}
      class="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
    >
      {showHidden ? 'Hide' : 'Show'} archived / removed
    </button>
  </div>
</div>

<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Tags for bucketing bills, subscriptions, and expenses - useful for reporting later. They don't
  track spend or budget themselves; see <a
    href="/expenses"
    class="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
    >Expenses</a
  > for that. Drag a category to reorder it within its group; move it under another category (or back
  to the top level) from its edit form.
</p>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else}
  <Card class="mt-6 overflow-x-auto">
    {#if orderedNonSystem.length > 0}
      <CategoryTree
        top={orderedNonSystem}
        childrenById={orderedChildren}
        {parentOptions}
        {collapsedIds}
        {editingId}
        {reordering}
        {savingEdit}
        zoneType="top"
        bind:editName
        bind:editColor
        bind:editParentId
        ontoggleCollapse={toggleCollapse}
        onstartEdit={startEdit}
        oncancelEdit={cancelEdit}
        onsaveEdit={saveEdit}
        onarchive={handleArchive}
        onreorderTop={reorderNonSystem}
        onreorderChildren={reorderChildren}
      />
    {:else if orderedSystem.length === 0}
      <p class="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        No categories yet.
      </p>
    {/if}

    {#if showHidden}
      {#if archivedCategories.length > 0}
        <div class="bg-slate-50 px-3 py-1.5 dark:bg-slate-900/40">
          <span
            class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
            >Archived</span
          >
        </div>
        {#each archivedCategories as category (category.id)}
          {#if editingId === category.id}
            {@render hiddenEditRow(category)}
          {:else}
            <div
              class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5 opacity-70 last:border-0 dark:border-slate-700/60"
            >
              <span class="w-6 shrink-0"></span>
              <span
                class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                style="background-color: {category.color ?? '#94a3b8'}"
              ></span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{category.name}</span>
              {#if category.parentId !== null}
                <span class="text-xs text-slate-400 dark:text-slate-500"
                  >under {parentName(category.parentId)}</span
                >
              {/if}
              <StatusBadge label="Archived" tone="slate" />
              <div class="ml-auto flex shrink-0 items-center gap-1">
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
              </div>
            </div>
          {/if}
        {/each}
      {/if}

      {#if removedCategories.length > 0}
        <div class="bg-slate-50 px-3 py-1.5 dark:bg-slate-900/40">
          <span
            class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
            >Removed</span
          >
        </div>
        {#each removedCategories as category (category.id)}
          {#if editingId === category.id}
            {@render hiddenEditRow(category)}
          {:else}
            <div
              class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5 opacity-60 last:border-0 dark:border-slate-700/60"
            >
              <span class="w-6 shrink-0"></span>
              <span
                class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                style="background-color: {category.color ?? '#94a3b8'}"
              ></span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{category.name}</span>
              {#if category.parentId !== null}
                <span class="text-xs text-slate-400 dark:text-slate-500"
                  >under {parentName(category.parentId)}</span
                >
              {/if}
              <StatusBadge label="Removed" tone="slate" />
              <div class="ml-auto flex shrink-0 items-center gap-1">
                <IconActionButton
                  variant="success"
                  label="Restore {category.name}"
                  path={mdiRestore}
                  onclick={() => handleRestore(category)}
                />
              </div>
            </div>
          {/if}
        {/each}
      {/if}
    {/if}

    {#if orderedSystem.length > 0}
      <div class="bg-slate-50 px-3 py-1.5 dark:bg-slate-900/40">
        <span
          class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
          >System categories</span
        >
      </div>
      <CategoryTree
        top={orderedSystem}
        childrenById={orderedChildren}
        {parentOptions}
        {collapsedIds}
        {editingId}
        {reordering}
        {savingEdit}
        zoneType="system-top"
        bind:editName
        bind:editColor
        bind:editParentId
        ontoggleCollapse={toggleCollapse}
        onstartEdit={startEdit}
        oncancelEdit={cancelEdit}
        onsaveEdit={saveEdit}
        onarchive={handleArchive}
        onreorderTop={reorderSystem}
        onreorderChildren={reorderChildren}
      />
    {/if}
  </Card>

  <form onsubmit={handleAdd} class="mt-6 flex flex-wrap items-end gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Name</span>
      <input
        type="text"
        placeholder="Add a category (e.g. Household)"
        bind:value={newName}
        class="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Parent (optional)</span>
      <select
        bind:value={newParentId}
        class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">Top level</option>
        {#each parentOptions as parent (parent.id)}
          <option value={String(parent.id)}>{parent.name}</option>
        {/each}
      </select>
    </label>
    <Button type="submit" size="lg" disabled={creating}>
      {creating ? 'Adding…' : 'Add category'}
    </Button>
  </form>
{/if}
