<script lang="ts">
  import type { Category } from '$lib/api/categories'
  import { lifecycleState, type LifecycleAction } from '$lib/lifecycle'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPencil, mdiPackageUp, mdiDelete, mdiRestore } from '@mdi/js'

  interface Props {
    categories: Category[]
    /** Resolves a parent id to its display name for the "under X" caption. */
    parentNameFor: (id: number) => string | null
    onEdit: (category: Category) => void
    onLifecycle: (category: Category, action: LifecycleAction) => void
  }

  let { categories, parentNameFor, onEdit, onLifecycle }: Props = $props()
</script>

{#each categories as category (category.id)}
  <div
    class="border-rule flex flex-wrap items-center gap-2 border-b px-3 py-1.5 last:border-0"
  >
    <span class="w-6 shrink-0"></span>
    <span
      class="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/10"
      style="background-color: {category.color ?? '#94a3b8'}"
    ></span>
    <span class="text-foreground font-medium">{category.name}</span>
    {#if category.parentId !== null}
      <span class="text-muted-foreground text-xs">under {parentNameFor(category.parentId)}</span>
    {/if}
    <div class="ml-auto flex shrink-0 items-center gap-1">
      {#if lifecycleState(category) === 'archived'}
        <IconActionButton
          variant="neutral"
          label="Edit {category.name}"
          path={mdiPencil}
          onclick={() => onEdit(category)}
        />
        <IconActionButton
          variant="success"
          label="Unarchive {category.name}"
          path={mdiPackageUp}
          onclick={() => onLifecycle(category, 'unarchive')}
        />
        <IconActionButton
          variant="danger"
          label="Delete {category.name}"
          path={mdiDelete}
          onclick={() => onLifecycle(category, 'delete')}
        />
      {:else}
        <IconActionButton
          variant="success"
          label="Restore {category.name}"
          path={mdiRestore}
          onclick={() => onLifecycle(category, 'restore')}
        />
      {/if}
    </div>
  </div>
{/each}
