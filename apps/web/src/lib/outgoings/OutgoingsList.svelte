<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte'
  import { dragHandleZone, type DndEvent } from 'svelte-dnd-action'
  import { toast } from 'svelte-sonner'
  import { listCategories, type Category } from '$lib/api/categories'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { ApiError } from '$lib/api'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import EmptyState from '$lib/components/app/EmptyState.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import DragHandle from '$lib/components/DragHandle.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs'
  import {
    groupByLifecycle,
    lifecyclePatch,
    LIFECYCLE_ACTION_TOASTS,
    type LifecycleAction,
    type LifecycleState,
  } from '$lib/lifecycle'
  import { outgoingMenuActions } from './menu'
  import OutgoingFormSheet from './OutgoingFormSheet.svelte'
  import type { OutgoingAdapter, OutgoingFormValues, OutgoingRecord } from './types'

  interface Props {
    adapter: OutgoingAdapter<OutgoingRecord>
    /** Scope the list to one person (Subscriptions). Changing it reloads. */
    userId?: number
    /** Prefill for the add form, e.g. the selected person on Subscriptions. */
    addDefaults?: OutgoingFormValues
    /** Extra content between the page header and the list, e.g. a person switcher. */
    header?: Snippet
  }

  let { adapter, userId, addDefaults, header }: Props = $props()

  let items = $state<OutgoingRecord[]>([])
  let categories = $state<Category[]>([])
  let users = $state<UserSummary[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let activeState = $state<LifecycleState>('active')
  let formOpen = $state(false)
  let editingItem = $state<OutgoingRecord | null>(null)
  let reordering = $state(false)

  const COLUMN_COUNT = $derived(adapter.columns.length + 2) // name + columns + actions

  const groups = $derived(groupByLifecycle(items))
  const visible = $derived(
    adapter.supportsLifecycle ? (groups.find((g) => g.state === activeState)?.items ?? []) : items
  )

  // Grouped rows (e.g. bills by frequency) - a single unlabelled group when
  // the adapter doesn't group.
  const grouped = $derived.by(() => {
    if (!adapter.supportsGrouping || !adapter.group) {
      return [{ key: '__all', label: '', items: visible }]
    }
    const buckets = new Map<string, OutgoingRecord[]>()
    for (const item of visible) {
      const key = adapter.group(item) ?? ''
      const bucket = buckets.get(key)
      if (bucket) bucket.push(item)
      else buckets.set(key, [item])
    }
    const order = adapter.groupOrder ?? [...buckets.keys()]
    const keys = [
      ...order.filter((key) => buckets.has(key)),
      ...[...buckets.keys()].filter((key) => !order.includes(key)),
    ]
    return keys.map((key) => ({
      key,
      label: adapter.groupLabel?.(key) ?? key,
      items: buckets.get(key) ?? [],
    }))
  })

  // Local, drag-reorderable copy - synced from the visible rows, then
  // diverges during a drag so the zone can preview the new order.
  let orderedVisible = $state<OutgoingRecord[]>([])
  $effect(() => {
    orderedVisible = visible
  })

  onMount(() => load())

  async function load() {
    loading = true
    try {
      await refresh()
    } finally {
      loading = false
    }
    // After `loading` clears, so the table actually exists to scroll to.
    await scrollToAnchor()
  }

  /** Re-fetch without flipping `loading`, so the table isn't unmounted (and scroll reset) on every mutation. */
  async function refresh() {
    error = null
    try {
      const [categoryList, userList, list] = await Promise.all([
        listCategories(),
        listUsers(),
        adapter.list({ includeHidden: true, userId }),
      ])
      categories = categoryList
      users = userList
      items = list
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load'
    }
  }

  // A `#bill-12` deep link (e.g. from the Monthly page) only resolves once
  // the rows have rendered, since the browser's own load-time hash scroll
  // runs before this client-rendered SPA has any rows. Redo it by hand and
  // flash the row so it's easy to spot.
  async function scrollToAnchor() {
    if (!window.location.hash) return
    await tick()
    const target = document.getElementById(window.location.hash.slice(1))
    target?.scrollIntoView()
    target?.classList.add('highlight-flash')
  }

  function actionsFor(item: OutgoingRecord) {
    return outgoingMenuActions(adapter.supportsLifecycle ? adapter.state(item) : null, {
      onEdit: () => startEdit(item),
      onLifecycle: (action) => runLifecycle(item, action),
    })
  }

  function startEdit(item: OutgoingRecord) {
    editingItem = item
    formOpen = true
  }

  function startAdd() {
    editingItem = null
    formOpen = true
  }

  async function runLifecycle(item: OutgoingRecord, action: LifecycleAction) {
    error = null
    try {
      if (action === 'delete') {
        const confirmed = await confirmDestructive({
          title: `Delete "${item.name}"?`,
          description: 'This cannot be undone.',
        })
        if (!confirmed) return
        await adapter.remove(item.id)
      } else {
        await adapter.setLifecycle(item.id, lifecyclePatch(action))
      }
      toast.success(`${adapter.singular} ${LIFECYCLE_ACTION_TOASTS[action]}`)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : `Failed to ${action}`
    }
  }

  async function submit(values: OutgoingFormValues) {
    if (editingItem) {
      await adapter.update(editingItem.id, values, editingItem)
      toast.success(`${adapter.singular} updated`)
    } else {
      await adapter.create(values)
      toast.success(`${adapter.singular} added`)
    }
    formOpen = false
    editingItem = null
    await refresh()
  }

  function consider(event: CustomEvent<DndEvent<OutgoingRecord>>) {
    orderedVisible = event.detail.items
  }

  async function finalize(event: CustomEvent<DndEvent<OutgoingRecord>>) {
    orderedVisible = event.detail.items
    if (!adapter.reorder) return
    reordering = true
    error = null
    try {
      await adapter.reorder(event.detail.items)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reorder'
    } finally {
      reordering = false
    }
  }

  const dragEnabled = $derived(adapter.supportsReorder && activeState === 'active')
</script>

<PageHeader title={adapter.title} description={adapter.description}>
  {#snippet actions()}
    <Button onclick={startAdd}>Add {adapter.singular.toLowerCase()}</Button>
  {/snippet}
</PageHeader>

{#if header}
  <div class="mt-4">{@render header()}</div>
{/if}

{#if adapter.supportsLifecycle}
  <Tabs bind:value={activeState} class="mt-4">
    <TabsList>
      {#each groups as group (group.state)}
        <!-- The vendored trigger's own `text-foreground/60` only reaches
             4.28:1 on the tabs background, so override it with the muted-ink
             token (tailwind-merge drops the earlier colour). -->
        <TabsTrigger value={group.state} class="text-muted-ink dark:text-muted-ink">
          {group.label}
          <span class="text-muted-foreground ml-1 text-xs">{group.items.length}</span>
        </TabsTrigger>
      {/each}
    </TabsList>
  </Tabs>
{/if}

{#if loading}
  <div class="mt-4">
    <LoadingSkeleton rows={4} />
  </div>
{:else if error && items.length === 0}
  <div class="mt-4"><ErrorMessage message={error} /></div>
{:else}
  {#if error}
    <div class="mt-4"><ErrorMessage message={error} /></div>
  {/if}
  {#if visible.length === 0}
    <Card class="mt-4">
      <EmptyState message={adapter.emptyMessage}>
        {#snippet action()}
          <Button size="sm" onclick={startAdd}>Add {adapter.singular.toLowerCase()}</Button>
        {/snippet}
      </EmptyState>
    </Card>
  {:else}
    <Card class="mt-4 sm:overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead class="hidden sm:table-header-group">
          <tr class="border-border border-b">
            <th class="text-muted-foreground px-3 py-2 text-left font-medium">Name</th>
            {#if adapter.supportsReorder}
              <th class="w-8"></th>
            {/if}
            {#each adapter.columns as column (column.key)}
              <th
                class={[
                  'text-muted-foreground px-3 py-2 font-medium',
                  column.align === 'right' ? 'text-right' : 'text-left',
                ]}
              >
                {column.label}
              </th>
            {/each}
            <th class="w-12"></th>
          </tr>
        </thead>

        {#if dragEnabled}
          <tbody
            class="block sm:table-row-group"
            use:dragHandleZone={{
              items: orderedVisible,
              flipDurationMs: 150,
              dragDisabled: reordering,
            }}
            onconsider={consider}
            onfinalize={finalize}
          >
            {#each orderedVisible as item (item.id)}
              {@render itemRow(item)}
            {/each}
          </tbody>
        {:else}
          <tbody class="block sm:table-row-group">
            {#each grouped as group (group.key)}
              {#if group.label}
                <tr class="border-border bg-ground block border-b sm:table-row">
                  <td
                    colspan={COLUMN_COUNT + (adapter.supportsReorder ? 1 : 0)}
                    class="text-muted-foreground block px-3 py-1.5 text-xs font-semibold sm:table-cell"
                  >
                    {group.label}
                  </td>
                </tr>
              {/if}
              {#each group.items as item (item.id)}
                {@render itemRow(item)}
              {/each}
            {/each}
          </tbody>
        {/if}
      </table>
    </Card>
  {/if}
{/if}

{#snippet itemRow(item: OutgoingRecord)}
  <tr
    id={adapter.anchorId?.(item) ?? undefined}
    class="divide-border border-border bg-card sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
  >
    {#if adapter.supportsReorder}
      <td class="hidden px-3 py-2 text-center sm:table-cell">
        {#if dragEnabled}
          <DragHandle label="Move {item.name}" />
        {/if}
      </td>
    {/if}
    <td
      class="text-foreground flex min-h-12 items-center justify-between gap-3 px-3 py-2 font-medium sm:table-cell sm:min-h-0"
    >
      <span class="flex min-w-0 flex-col">
        <span class="flex items-center gap-2">
          {#if dragEnabled}
            <span class="shrink-0 sm:hidden"><DragHandle label="Move {item.name}" /></span>
          {/if}
          <a href={adapter.href(item)} class="hover:text-primary truncate">{item.name}</a>
        </span>
        <span class="text-muted-foreground text-xs font-normal">
          {adapter.subtitle(item, { categories, users })}
        </span>
      </span>
      <span class="shrink-0 sm:hidden">
        <ActionMenu label="Actions for {item.name}" actions={actionsFor(item)} />
      </span>
    </td>
    {#each adapter.columns as column (column.key)}
      <td
        class={[
          'text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell',
          column.align === 'right' ? 'sm:text-right' : '',
          column.money ? 'font-figures' : '',
        ]}
      >
        <span class="text-muted-foreground shrink-0 text-xs sm:hidden">{column.label}</span>
        <span>{adapter.rowValues(item, { categories, users })[column.key] ?? ''}</span>
      </td>
    {/each}
    <td class="hidden justify-end px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right">
      <ActionMenu label="Actions for {item.name}" actions={actionsFor(item)} />
    </td>
  </tr>
{/snippet}

<OutgoingFormSheet
  open={formOpen}
  onOpenChange={(open) => {
    formOpen = open
    if (!open) editingItem = null
  }}
  {adapter}
  {categories}
  {users}
  item={editingItem}
  defaults={addDefaults}
  onSubmit={submit}
/>
