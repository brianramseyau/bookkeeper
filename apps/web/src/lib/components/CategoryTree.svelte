<script lang="ts">
  import { dragHandleZone, type DndEvent } from 'svelte-dnd-action'
  import { mdiPencil, mdiArchive, mdiChevronRight, mdiChevronDown } from '@mdi/js'
  import type { Category } from '$lib/api/categories'
  import type { LifecycleAction } from '$lib/lifecycle'
  import DragHandle from './DragHandle.svelte'
  import IconActionButton from './IconActionButton.svelte'
  import StatusBadge from './StatusBadge.svelte'

  interface Props {
    /** Ordered top-level rows for this zone - each with its own drag handle. */
    top: Category[]
    /** Ordered children per parent id; only parents with entries render a chevron/nest. */
    childrenById: Record<number, Category[]>
    /** Parent ids currently collapsed. */
    collapsedIds: Set<number>
    reordering: boolean
    /** Unique dnd zone type so items can't be dragged into a different sibling group. */
    zoneType: string
    ontoggleCollapse: (id: number) => void
    onstartEdit: (category: Category) => void
    onlifecycle: (category: Category, action: LifecycleAction) => void
    onreorderTop: (items: Category[], finalize?: boolean) => void
    onreorderChildren: (parentId: number, items: Category[], finalize?: boolean) => void
  }

  let {
    top,
    childrenById,
    collapsedIds,
    reordering,
    zoneType,
    ontoggleCollapse,
    onstartEdit,
    onlifecycle,
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
    <div class="border-rule border-b last:border-0">
      <div class="flex flex-wrap items-center gap-2 px-3 py-1.5">
        {#if hasChildren(category.id)}
          <button
            type="button"
            aria-expanded={!isCollapsed(category.id)}
            aria-label={isCollapsed(category.id)
              ? `Expand ${category.name}`
              : `Collapse ${category.name}`}
            onclick={() => ontoggleCollapse(category.id)}
            class="text-muted-foreground hover:bg-muted hover:text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
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
        <span class="text-foreground font-medium">{category.name}</span>
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
              onclick={() => onlifecycle(category, 'archive')}
            />
          {/if}
        </div>
      </div>

      {#if hasChildren(category.id) && !isCollapsed(category.id)}
        <div class="bg-muted/40 pl-8 sm:pl-10">
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
              <div class="border-rule border-b last:border-0">
                <div class="flex flex-wrap items-center gap-2 px-3 py-1.5">
                  <DragHandle label="Move {child.name}" compact />
                  <span
                    class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                    style="background-color: {child.color ?? '#94a3b8'}"
                  ></span>
                  <span class="text-foreground font-medium">{child.name}</span>
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
                      onclick={() => onlifecycle(child, 'archive')}
                    />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>
