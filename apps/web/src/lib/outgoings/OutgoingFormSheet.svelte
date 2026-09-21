<script lang="ts">
  import type { Category } from '$lib/api/categories'
  import type { UserSummary } from '$lib/api/users'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import CategorySelect from '$lib/components/CategorySelect.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import type { OutgoingAdapter, OutgoingField, OutgoingFormValues, OutgoingRecord } from './types'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    adapter: OutgoingAdapter<OutgoingRecord>
    categories: Category[]
    users: UserSummary[]
    /** The item being edited, or null when adding. */
    item: OutgoingRecord | null
    /** Prefill for an add, e.g. the currently-selected person on Subscriptions. */
    defaults?: OutgoingFormValues
    onSubmit: (values: OutgoingFormValues) => Promise<void>
  }

  let { open, onOpenChange, adapter, categories, users, item, defaults, onSubmit }: Props = $props()

  const fields = $derived(
    item ? (adapter.editFieldsFor?.(item) ?? adapter.editFields ?? adapter.fields) : adapter.fields
  )
  const isEdit = $derived(item !== null)

  let values = $state<OutgoingFormValues>({})
  let submitting = $state(false)
  let error = $state<string | null>(null)

  // Re-seed the draft whenever the sheet opens for a different item (or for
  // an add). Keyed on `open` + id so closing/reopening the same row resets
  // any unsaved edits. Builds the new draft in a local (never reading the
  // `values` state it writes) so it can't loop.
  $effect(() => {
    if (!open) return
    const fieldList = fields
    if (item) {
      values = adapter.toFormValues(item, { categories, users })
    } else {
      const draft: OutgoingFormValues = {}
      for (const field of fieldList) draft[field.key] = field.type === 'checkbox' ? false : ''
      Object.assign(draft, defaults ?? {})
      values = draft
    }
    error = null
  })

  // Selects are the one place this stringification matters beyond display:
  // Svelte stores each <option>'s raw JS value in `option.__value` and matches
  // it against the select's raw `value` with `Object.is`, so a numeric option
  // value (user ids, category ids) never matches this string and the select
  // renders with nothing selected (`selectedIndex === -1`), and clears again
  // the moment the user picks one. Every option value below is therefore
  // stringified to match - don't drop the `String(...)`.
  function display(field: OutgoingField): string {
    const value = values[field.key]
    if (value === null || value === undefined) return ''
    return String(value)
  }

  function setValue(key: string, value: string | number | boolean) {
    values = { ...values, [key]: value }
  }

  /**
   * A cleared number input yields '' (and clearing an already-filled one can
   * yield null), so a required guard written as just Number.isNaN silently
   * lets a blank field through - see AGENTS.md's number-input note.
   */
  function requiredMessage(field: OutgoingField): string {
    const label = field.label.toLowerCase()
    return `Enter ${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label}`
  }

  function validate(): string | null {
    for (const field of fields) {
      if (field.type !== 'number') {
        if (field.required && display(field).trim() === '') {
          return requiredMessage(field)
        }
        continue
      }
      const raw = values[field.key]
      const blank = raw === '' || raw === null || raw === undefined
      if (blank) {
        if (field.required) return requiredMessage(field)
        continue
      }
      if (Number.isNaN(Number(raw))) return `Enter a valid ${field.label.toLowerCase()}`
    }
    return null
  }

  async function submit() {
    const message = validate()
    if (message) {
      error = message
      return
    }
    submitting = true
    error = null
    try {
      await onSubmit(values)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Something went wrong'
    } finally {
      submitting = false
    }
  }
</script>

<ResponsiveFormSheet
  {open}
  {onOpenChange}
  title={isEdit
    ? `Edit ${adapter.singular.toLowerCase()}`
    : `Add ${adapter.singular.toLowerCase()}`}
>
  <form
    id="outgoing-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    {#each fields as field (field.key)}
      <div class="flex flex-col gap-1">
        {#if field.type === 'checkbox'}
          <label class="flex items-center gap-2">
            <input
              type="checkbox"
              class="border-input size-4 rounded"
              checked={Boolean(values[field.key])}
              onchange={(event) => setValue(field.key, event.currentTarget.checked)}
            />
            <span class="text-foreground text-sm font-medium">{field.label}</span>
          </label>
        {:else}
          <label class="text-muted-foreground text-xs font-medium" for="field-{field.key}">
            {field.label}
          </label>
          {#if field.type === 'select'}
            <select
              id="field-{field.key}"
              class="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              value={display(field)}
              onchange={(event) => setValue(field.key, event.currentTarget.value)}
            >
              {#each field.options ?? [] as option (option.value)}
                <option value={String(option.value)}>{option.label}</option>
              {/each}
            </select>
          {:else if field.type === 'category'}
            <CategorySelect
              {categories}
              value={(values[field.key] as number | string | null) ?? ''}
              onchange={(value) => setValue(field.key, value)}
            />
          {:else if field.type === 'user'}
            <select
              id="field-{field.key}"
              class="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              value={display(field)}
              onchange={(event) => setValue(field.key, event.currentTarget.value)}
            >
              <option value="">Choose a person</option>
              {#each users as user (user.id)}
                <option value={String(user.id)}>{user.fullName ?? user.email}</option>
              {/each}
            </select>
          {:else}
            <Input
              id="field-{field.key}"
              type={field.type}
              placeholder={field.placeholder}
              step={field.step}
              min={field.min}
              value={display(field)}
              oninput={(event) => setValue(field.key, event.currentTarget.value)}
            />
          {/if}
        {/if}
        {#if field.hint}
          <p class="text-muted-foreground text-xs">{field.hint}</p>
        {/if}
      </div>
    {/each}
  </form>

  {#snippet footer()}
    {#if error}
      <p class="text-over mr-auto text-sm">{error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="button" onclick={submit} disabled={submitting}>
      {isEdit ? 'Save changes' : `Add ${adapter.singular.toLowerCase()}`}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
