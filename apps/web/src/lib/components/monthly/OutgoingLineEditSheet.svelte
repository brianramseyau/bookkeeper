<script lang="ts" module>
  import type { StandardMonthLine } from '$lib/api/standard-month'

  export type ExpenseEditMode =
    | 'utility'
    | 'recurring-bill'
    | 'subscription'
    | 'expense-add'
    | 'expense-edit'
    | 'expense-multiple'

  /**
   * What the sheet is open for. The parent resolves an expense's actuals
   * (there may be none, one, or several) before choosing the mode, so the
   * sheet itself stays presentational - it never calls the API.
   * `expense-multiple` means the row has more than one actual this month and
   * can't be edited in place; the sheet just points at the detail page.
   */
  export type OutgoingLineEditTarget = {
    mode: ExpenseEditMode
    line: StandardMonthLine
    /** The expense's own id - only set for the expense modes. */
    expenseId?: number
    /** The actual being edited - only set for `expense-edit`. */
    actualId?: number
  }

  export interface OutgoingLineEditValues {
    amount: number
    /** Utilities only - the date the bill was received. */
    receivedOn: string
  }
</script>

<script lang="ts">
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The line being edited, or null while the sheet is closed. */
    target: OutgoingLineEditTarget | null
    submitting: boolean
    error?: string | null
    onSave: (values: OutgoingLineEditValues) => void
    /** Only rendered for `expense-edit`, where there's an actual to remove. */
    onRemove: () => void
  }

  let { open, onOpenChange, target, submitting, error, onSave, onRemove }: Props = $props()

  let amount = $state<number>(NaN)
  let receivedOn = $state('')

  const mode = $derived(target?.mode ?? null)
  const isAdd = $derived(mode === 'expense-add')
  const isMultiple = $derived(mode === 'expense-multiple')
  const hasReceivedOn = $derived(mode === 'utility')

  // Re-seed the draft whenever the sheet opens for a (possibly new) line,
  // mirroring the other sheets' re-seed effects.
  $effect(() => {
    if (!open || !target) return
    const line = target.line
    if (target.mode === 'utility') {
      amount = line.actual ?? NaN
      receivedOn = line.receivedOn?.slice(0, 10) ?? ''
    } else if (target.mode === 'expense-add') {
      amount = NaN
      receivedOn = ''
    } else {
      amount = line.actual ?? line.projected ?? NaN
      receivedOn = ''
    }
  })

  function submit() {
    onSave({ amount, receivedOn })
  }

  const title = $derived(
    target ? `${isAdd ? 'Add' : 'Edit'} ${target.line.label}` : 'Edit outgoing line'
  )
  const description = $derived(
    isMultiple
      ? `There are multiple entries for ${target?.line.label} this month. Edit them from the expense's own page.`
      : undefined
  )
</script>

<ResponsiveFormSheet {open} {onOpenChange} {title} {description}>
  {#if isMultiple}
    <div class="py-2">
      <Button
        variant="outline"
        href={target?.expenseId ? `/expenses/${target.expenseId}` : undefined}
      >
        Open {target?.line.label}
      </Button>
    </div>
  {:else}
    <form
      id="outgoing-line-edit-form"
      class="flex flex-col gap-4 py-2"
      onsubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-xs font-medium" for="outgoing-line-amount"
          >Amount</label
        >
        <Input id="outgoing-line-amount" type="number" step="0.01" min="0" bind:value={amount} />
      </div>
      {#if hasReceivedOn}
        <div class="flex flex-col gap-1">
          <label class="text-muted-foreground text-xs font-medium" for="outgoing-line-received-on"
            >Received on</label
          >
          <Input id="outgoing-line-received-on" type="date" bind:value={receivedOn} />
        </div>
      {/if}
    </form>
  {/if}

  {#snippet footer()}
    {#if error}
      <p class="text-over mr-auto text-sm">{error}</p>
    {/if}
    {#if mode === 'expense-edit'}
      <Button variant="destructive" class="mr-auto" disabled={submitting} onclick={onRemove}>
        Delete entry
      </Button>
    {/if}
    {#if isMultiple}
      <Button variant="outline" onclick={() => onOpenChange(false)}>Close</Button>
    {:else}
      <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" form="outgoing-line-edit-form" disabled={submitting}>
        {submitting ? 'Saving…' : isAdd ? 'Add entry' : 'Save changes'}
      </Button>
    {/if}
  {/snippet}
</ResponsiveFormSheet>
