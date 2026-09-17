<script lang="ts" module>
  export interface ExpenseActualFormValues {
    /** "YYYY-MM" - converted to an ISO date (last day of month) by the caller. */
    occurredMonth: string
    amount: number
    notes: string
  }
</script>

<script lang="ts">
  import type { ExpenseMonthlyActual } from '$lib/api/expense-actuals'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import MonthYearPicker from '$lib/components/MonthYearPicker.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The actual being edited, or null when adding. */
    item: ExpenseMonthlyActual | null
    submitting: boolean
    error?: string | null
    onSubmit: (values: ExpenseActualFormValues) => void
  }

  let { open, onOpenChange, item, submitting, error, onSubmit }: Props = $props()

  let occurredMonth = $state('')
  let amount = $state<number>(NaN)
  let notes = $state('')
  let validationError = $state<string | null>(null)
  // Snapshotted (not `$derived` off `item`) so the title/submit label don't
  // flip to "Add..." mid-close when the caller nulls `item` as soon as
  // `onOpenChange(false)` fires, while the sheet is still animating out.
  let isEdit = $state(false)

  // Re-seed the draft whenever the sheet opens for a (possibly new) actual.
  $effect(() => {
    if (!open) return
    isEdit = item !== null
    occurredMonth = item?.occurredOn.slice(0, 7) ?? ''
    amount = item?.amount ?? NaN
    notes = item?.notes ?? ''
    validationError = null
  })

  function submit() {
    // A cleared number input yields `null`, not NaN - see AGENTS.md.
    if (!occurredMonth || Number.isNaN(amount) || amount === null) {
      validationError = 'Month and amount are required'
      return
    }
    validationError = null
    onSubmit({ occurredMonth, amount, notes: notes.trim() })
  }
</script>

<ResponsiveFormSheet {open} {onOpenChange} title={isEdit ? 'Edit entry' : 'Add entry'}>
  <form
    id="expense-actual-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="expense-actual-month"
        >Month</label
      >
      <MonthYearPicker id="expense-actual-month" bind:value={occurredMonth} size="form" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="expense-actual-amount"
        >Amount</label
      >
      <Input id="expense-actual-amount" type="number" step="0.01" min="0" bind:value={amount} />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="expense-actual-notes"
        >Notes</label
      >
      <Input id="expense-actual-notes" type="text" placeholder="optional" bind:value={notes} />
    </div>
  </form>

  {#snippet footer()}
    {#if validationError ?? error}
      <p class="text-over mr-auto text-sm">{validationError ?? error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="expense-actual-form" disabled={submitting}>
      {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
