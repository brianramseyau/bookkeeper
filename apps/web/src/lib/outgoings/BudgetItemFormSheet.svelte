<script lang="ts" module>
  export interface BudgetItemFormValues {
    name: string
    amount: number
  }
</script>

<script lang="ts">
  import type { ExpenseBudgetItem } from '$lib/api/expense-budget-items'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The item being edited, or null when adding. */
    item: ExpenseBudgetItem | null
    submitting: boolean
    error?: string | null
    onSubmit: (values: BudgetItemFormValues) => void
  }

  let { open, onOpenChange, item, submitting, error, onSubmit }: Props = $props()

  let name = $state('')
  let amount = $state<number>(NaN)
  let validationError = $state<string | null>(null)

  const isEdit = $derived(item !== null)

  // Re-seed the draft whenever the sheet opens for a (possibly new) item.
  $effect(() => {
    if (!open) return
    name = item?.name ?? ''
    amount = item?.amount ?? NaN
    validationError = null
  })

  function submit() {
    // A cleared number input yields `null`, not NaN - see AGENTS.md.
    if (!name.trim() || Number.isNaN(amount) || amount === null) {
      validationError = 'Name and amount are required'
      return
    }
    validationError = null
    onSubmit({ name: name.trim(), amount })
  }
</script>

<ResponsiveFormSheet {open} {onOpenChange} title={isEdit ? 'Edit budget item' : 'Add budget item'}>
  <form
    id="budget-item-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="budget-item-name">Item</label>
      <Input id="budget-item-name" type="text" placeholder="e.g. Insurance" bind:value={name} />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="budget-item-amount"
        >Amount</label
      >
      <Input id="budget-item-amount" type="number" step="0.01" min="0" bind:value={amount} />
    </div>
  </form>

  {#snippet footer()}
    {#if validationError ?? error}
      <p class="text-over mr-auto text-sm">{validationError ?? error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="budget-item-form" disabled={submitting}>
      {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
