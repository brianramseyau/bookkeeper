<script lang="ts" module>
  export interface CategoryFormValues {
    name: string
    color: string
    parentId: number | null
  }
</script>

<script lang="ts">
  import type { Category } from '$lib/api/categories'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The category being edited, or null when adding. */
    category: Category | null
    /** Top-level categories offered as parents (excludes the row being edited). */
    parentOptions: Category[]
    /** A category with children stays at the top level. */
    hasChildren: boolean
    submitting: boolean
    error?: string | null
    onSubmit: (values: CategoryFormValues) => void
  }

  let {
    open,
    onOpenChange,
    category,
    parentOptions,
    hasChildren,
    submitting,
    error,
    onSubmit,
  }: Props = $props()

  const isEdit = $derived(category !== null)
  const isSystem = $derived(category?.isSystem ?? false)

  let name = $state('')
  let color = $state('#64748b')
  let parentId = $state('')
  let validationError = $state<string | null>(null)

  // Re-seed the draft whenever the sheet opens for a (possibly new) category,
  // mirroring the other sheets' re-seed effects.
  $effect(() => {
    if (!open) return
    if (category) {
      name = category.name
      color = category.color ?? '#64748b'
      parentId = category.parentId === null ? '' : String(category.parentId)
    } else {
      name = ''
      color = '#64748b'
      parentId = ''
    }
    validationError = null
  })

  function submit() {
    if (!isSystem && !name.trim()) {
      validationError = 'Name is required'
      return
    }
    validationError = null
    onSubmit({
      name: name.trim(),
      color,
      parentId: parentId === '' ? null : Number(parentId),
    })
  }
</script>

<ResponsiveFormSheet
  {open}
  {onOpenChange}
  title={isEdit ? `Edit ${category?.name}` : 'Add category'}
>
  <form
    id="category-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    {#if isSystem}
      <p class="text-muted-foreground text-sm">
        This is a system category - only its color can change.
      </p>
    {:else}
      <div class="flex flex-col gap-2">
        <Label for="category-name">Name</Label>
        <Input id="category-name" type="text" placeholder="e.g. Household" bind:value={name} />
      </div>
    {/if}
    <div class="flex flex-col gap-2">
      <Label for="category-color">Color</Label>
      <input
        id="category-color"
        type="color"
        bind:value={color}
        class="border-input h-9 w-16 cursor-pointer rounded-md border bg-transparent p-1"
      />
    </div>
    {#if !isSystem}
      <div class="flex flex-col gap-2">
        <Label for="category-parent">Parent</Label>
        <select
          id="category-parent"
          bind:value={parentId}
          disabled={hasChildren}
          class="border-input h-8 rounded-lg border bg-transparent px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Top level</option>
          {#each parentOptions as parent (parent.id)}
            <option value={String(parent.id)}>{parent.name}</option>
          {/each}
        </select>
        {#if hasChildren}
          <p class="text-muted-foreground text-xs">
            A category with children stays at the top level.
          </p>
        {/if}
      </div>
    {/if}
  </form>

  {#snippet footer()}
    {#if validationError ?? error}
      <p class="text-over mr-auto text-sm">{validationError ?? error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="category-form" disabled={submitting}>
      {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add category'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
