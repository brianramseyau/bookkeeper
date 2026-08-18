<script lang="ts">
  import { dragHandleZone, type DndEvent } from 'svelte-dnd-action'
  import {
    mdiPencil,
    mdiArchive,
    mdiCloseThick,
    mdiContentSave,
    mdiChevronRight,
    mdiChevronDown,
  } from '@mdi/js'
  import type { Category } from '$lib/api/categories'
  import DragHandle from './DragHandle.svelte'
  import IconActionButton from './IconActionButton.svelte'
  import StatusBadge from './StatusBadge.svelte'

  interface Props {
    /** Ordered top-level rows for this zone - each with its own drag handle. */
    top: Category[]
    /** Ordered children per parent id; only parents with entries render a chevron/nest. */
    childrenById: Record<number, Category[]>
    /** Top-level categories offered as parents in the inline edit form (excludes the row being edited). */
    parentOptions: Category[]
    /** Parent ids currently collapsed. */
    collapsedIds: Set<number>
    editingId: number | null
    reordering: boolean
    savingEdit: boolean
    /** Unique dnd zone type so items can't be dragged into a different sibling group. */
    zoneType: string
    editName?: string
    editColor?: string
    editParentId?: string
    ontoggleCollapse: (id: number) => void
    onstartEdit: (category: Category) => void
    oncancelEdit: () => void
    onsaveEdit: (category: Category) => void
    onarchive: (category: Category) => void
    onreorderTop: (items: Category[], finalize?: boolean) => void
    onreorderChildren: (parentId: number, items: Category[], finalize?: boolean) => void
  }

  let {
    top,
    childrenById,
    parentOptions,
    collapsedIds,
    editingId,
    reordering,
    savingEdit,
    zoneType,
    editName = $bindable(''),
    editColor = $bindable('#64748b'),
    editParentId = $bindable(''),
    ontoggleCollapse,
    onstartEdit,
    oncancelEdit,
    onsaveEdit,
    onarchive,
    onreorderTop,
    onreorderChildren,
  }: Props = $props()

  const isCollapsed = (id: number) => collapsedIds.has(id)
  const childrenOf = (id: number) => childrenById[id] ?? []
  const hasChildren = (id: number) => childrenOf(id).length > 0

  function considerTop(e: CustomEvent<DndEvent<Category>>) {
    onreorderTop(e.detail.items)
  }

  function finalizeTop(e: CustomEvent<DndEvent<Category>>) {
    onreorderTop(e.detail.items, true)
  }

  function considerChildren(parentId: number, e: CustomEvent<DndEvent<Category>>) {
    onreorderChildren(parentId, e.detail.items)
  }

  function finalizeChildren(parentId: number, e: CustomEvent<DndEvent<Category>>) {
    onreorderChildren(parentId, e.detail.items, true)
  }
</script>

<div
  use:dragHandleZone={{
    items: top,
    flipDurationMs: 150,
    dragDisabled: reordering,
    type: zoneType,
  }}
  onconsider={considerTop}
  onfinalize={finalizeTop}
>
  {#each top as category (category.id)}
    <div class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
      {#if editingId === category.id}
        <div
          class="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-indigo-50/40 px-3 py-1.5 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
        >
          <span class="w-6 shrink-0"></span>
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
          <select
            bind:value={editParentId}
            disabled={hasChildren(category.id)}
            title={hasChildren(category.id)
              ? 'A category with children stays at the top level'
              : undefined}
            aria-label="Parent for {category.name}"
            class="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
              onclick={() => onsaveEdit(category)}
            />
            <IconActionButton
              variant="cancel"
              label="Cancel editing {category.name}"
              path={mdiCloseThick}
              onclick={oncancelEdit}
            />
          </div>
        </div>
      {:else}
        <div class="flex flex-wrap items-center gap-2 px-3 py-1.5">
          {#if hasChildren(category.id)}
            <button
              type="button"
              aria-expanded={!isCollapsed(category.id)}
              aria-label={isCollapsed(category.id)
                ? `Expand ${category.name}`
                : `Collapse ${category.name}`}
              onclick={() => ontoggleCollapse(category.id)}
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
                <path d={isCollapsed(category.id) ? mdiChevronRight : mdiChevronDown} />
              </svg>
            </button>
          {:else}
            <span class="w-6 shrink-0"></span>
          {/if}
          <DragHandle label="Move {category.name}" compact />
          <span
            class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
            style="background-color: {category.color ?? '#94a3b8'}"
          ></span>
          <span class="font-medium text-slate-900 dark:text-slate-100">{category.name}</span>
          {#if category.isSystem}
            <StatusBadge label="System" tone="slate" />
          {/if}
          <div class="ml-auto flex shrink-0 items-center gap-1">
            <IconActionButton
              variant="neutral"
              label="Edit {category.name}"
              path={mdiPencil}
              onclick={() => onstartEdit(category)}
            />
            {#if !category.isSystem}
              <IconActionButton
                variant="muted"
                label="Archive {category.name}"
                path={mdiArchive}
                onclick={() => onarchive(category)}
              />
            {/if}
          </div>
        </div>
      {/if}

      {#if hasChildren(category.id) && !isCollapsed(category.id)}
        <div class="bg-slate-50/70 pl-8 sm:pl-10 dark:bg-slate-900/30">
          <div
            use:dragHandleZone={{
              items: childrenOf(category.id),
              flipDurationMs: 150,
              dragDisabled: reordering,
              type: `children-${category.id}`,
            }}
            onconsider={(e) => considerChildren(category.id, e)}
            onfinalize={(e) => finalizeChildren(category.id, e)}
          >
            {#each childrenOf(category.id) as child (child.id)}
              <div class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                {#if editingId === child.id}
                  <div
                    class="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-indigo-50/40 px-3 py-1.5 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
                  >
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
                      aria-label="Parent for {child.name}"
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
                        label="Save {child.name}"
                        path={mdiContentSave}
                        onclick={() => onsaveEdit(child)}
                      />
                      <IconActionButton
                        variant="cancel"
                        label="Cancel editing {child.name}"
                        path={mdiCloseThick}
                        onclick={oncancelEdit}
                      />
                    </div>
                  </div>
                {:else}
                  <div class="flex flex-wrap items-center gap-2 px-3 py-1.5">
                    <DragHandle label="Move {child.name}" compact />
                    <span
                      class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                      style="background-color: {child.color ?? '#94a3b8'}"
                    ></span>
                    <span class="font-medium text-slate-900 dark:text-slate-100">{child.name}</span>
                    <div class="ml-auto flex shrink-0 items-center gap-1">
                      <IconActionButton
                        variant="neutral"
                        label="Edit {child.name}"
                        path={mdiPencil}
                        onclick={() => onstartEdit(child)}
                      />
                      <IconActionButton
                        variant="muted"
                        label="Archive {child.name}"
                        path={mdiArchive}
                        onclick={() => onarchive(child)}
                      />
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>
