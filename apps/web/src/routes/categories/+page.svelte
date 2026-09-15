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
  import { lifecyclePatch, LIFECYCLE_ACTION_TOASTS, type LifecycleAction } from '$lib/lifecycle'
  import { ApiError } from '$lib/api'
  import { toast } from 'svelte-sonner'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import CategoryTree from '$lib/components/CategoryTree.svelte'
  import CategoryLifecycleRows from '$lib/components/CategoryLifecycleRows.svelte'
  import CategoryFormSheet, {
    type CategoryFormValues,
  } from '$lib/components/CategoryFormSheet.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import { Button } from '$lib/components/ui/button'

  let categories = $state<Category[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showHidden = $state(false)
  let reordering = $state(false)

  // Adding and editing both happen in CategoryFormSheet - the target is null
  // when adding, the category being edited otherwise.
  let formOpen = $state(false)
  let formTarget = $state<Category | null>(null)
  let formSubmitting = $state(false)
  let formError = $state<string | null>(null)

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
    const target = formTarget
    const options = buildTopLevel(categories).filter((c) => c.id !== target?.id)
    if (target !== null) {
      const currentParent =
        target.parentId != null ? categories.find((c) => c.id === target.parentId) : undefined
      if (currentParent && !options.some((c) => c.id === currentParent.id)) {
        options.push(currentParent)
      }
    }
    return options
  })

  const formHasChildren = $derived(formTarget !== null && nestedParentIds.has(formTarget.id))

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
  // whole page to a loading placeholder, which unmounts the tree and resets
  // scroll position on every add/edit/archive/reorder action.
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

  function openAdd() {
    formTarget = null
    formError = null
    formOpen = true
  }

  function openEdit(category: Category) {
    formTarget = category
    formError = null
    formOpen = true
  }

  async function saveCategory(values: CategoryFormValues) {
    const target = formTarget
    formSubmitting = true
    formError = null
    error = null
    try {
      if (target) {
        await updateCategory(target.id, {
          // The system category can't be renamed - only its color/sortOrder.
          ...(target.isSystem ? {} : { name: values.name }),
          color: values.color,
          // Only send the parent when it actually changed, so a no-op edit of a
          // top-level category doesn't churn the payload.
          ...(target.parentId !== values.parentId ? { parentId: values.parentId } : {}),
        })
      } else {
        await createCategory({
          name: values.name,
          color: values.color,
          ...(values.parentId === null ? {} : { parentId: values.parentId }),
        })
      }
    } catch (err) {
      formError = err instanceof ApiError ? err.message : 'Failed to save category'
      formSubmitting = false
      return
    }
    formOpen = false
    formTarget = null
    formSubmitting = false
    toast.success(target ? 'Category saved' : 'Category added')
    await refresh()
  }

  async function runLifecycle(category: Category, action: LifecycleAction) {
    error = null
    try {
      if (action === 'delete') {
        const confirmed = await confirmDestructive({
          title: `Delete ${category.name}?`,
          description: 'This cannot be undone.',
        })
        if (!confirmed) return
        await deleteCategory(category.id)
      } else {
        await updateCategory(category.id, lifecyclePatch(action))
      }
      toast.success(`${category.name} ${LIFECYCLE_ACTION_TOASTS[action]}`)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : `Failed to ${action}`
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

<PageHeader
  title="Categories"
  description="Tags for bucketing bills, subscriptions, and expenses. Drag a category to reorder it within its group; move it under another category from its edit form."
>
  {#snippet actions()}
    <Button onclick={openAdd}>Add category</Button>
  {/snippet}
</PageHeader>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <div class="mt-6">
    <LoadingSkeleton rows={5} />
  </div>
{:else}
  <div class="mt-6 flex items-center justify-end gap-2">
    {#if nestedParentIds.size > 0}
      <Button variant="ghost" size="sm" onclick={toggleAll}>
        {allExpanded ? 'Unfold less' : 'Unfold more'}
      </Button>
    {/if}
    <Button variant="ghost" size="sm" onclick={() => (showHidden = !showHidden)}>
      {showHidden ? 'Hide' : 'Show'} archived / removed
    </Button>
  </div>

  <Card class="mt-3 overflow-x-auto">
    {#if orderedNonSystem.length > 0}
      <CategoryTree
        top={orderedNonSystem}
        childrenById={orderedChildren}
        {collapsedIds}
        {reordering}
        zoneType="top"
        ontoggleCollapse={toggleCollapse}
        onstartEdit={openEdit}
        onlifecycle={runLifecycle}
        onreorderTop={reorderNonSystem}
        onreorderChildren={reorderChildren}
      />
    {:else if orderedSystem.length === 0 && archivedCategories.length === 0 && removedCategories.length === 0}
      <p class="text-muted-foreground px-3 py-6 text-center text-sm">No categories yet.</p>
    {/if}

    {#if showHidden}
      {#if archivedCategories.length > 0}
        <div class="bg-muted/40 px-3 py-1.5">
          <span class="text-muted-foreground text-xs font-semibold">Archived</span>
        </div>
        <CategoryLifecycleRows
          categories={archivedCategories}
          parentNameFor={parentName}
          onEdit={openEdit}
          onLifecycle={runLifecycle}
        />
      {/if}

      {#if removedCategories.length > 0}
        <div class="bg-muted/40 px-3 py-1.5">
          <span class="text-muted-foreground text-xs font-semibold">Removed</span>
        </div>
        <CategoryLifecycleRows
          categories={removedCategories}
          parentNameFor={parentName}
          onEdit={openEdit}
          onLifecycle={runLifecycle}
        />
      {/if}
    {/if}

    {#if orderedSystem.length > 0}
      <div class="bg-muted/40 px-3 py-1.5">
        <span class="text-muted-foreground text-xs font-semibold">System categories</span>
      </div>
      <CategoryTree
        top={orderedSystem}
        childrenById={orderedChildren}
        {collapsedIds}
        {reordering}
        zoneType="system-top"
        ontoggleCollapse={toggleCollapse}
        onstartEdit={openEdit}
        onlifecycle={runLifecycle}
        onreorderTop={reorderSystem}
        onreorderChildren={reorderChildren}
      />
    {/if}
  </Card>
{/if}

<CategoryFormSheet
  open={formOpen}
  onOpenChange={(next) => {
    formOpen = next
    if (!next) formTarget = null
  }}
  category={formTarget}
  {parentOptions}
  hasChildren={formHasChildren}
  submitting={formSubmitting}
  error={formError}
  onSubmit={saveCategory}
/>
