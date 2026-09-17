<script lang="ts" module>
  export interface OutgoingHistoryEditValues {
    amount: number
  }
</script>

<script lang="ts">
  import type { OutgoingHistoryEntry } from './types'
  import { monthYearLabel } from '$lib/format'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The history entry being edited, or null while the sheet is closed. */
    entry: OutgoingHistoryEntry | null
    submitting: boolean
    error?: string | null
    onSubmit: (values: OutgoingHistoryEditValues) => void
  }

  let { open, onOpenChange, entry, submitting, error, onSubmit }: Props = $props()

  let amount = $state<number>(NaN)
  let validationError = $state<string | null>(null)
  // Snapshotted (not `$derived` off `entry`) so the title doesn't go blank
  // mid-close when the caller nulls `entry` as soon as `onOpenChange(false)`
  // fires, while the sheet is still animating out.
  let label = $state('')

  // Re-seed the draft whenever the sheet opens for a (possibly new) entry.
  $effect(() => {
    if (!open || !entry) return
    amount = entry.amount ?? NaN
    label = monthYearLabel(entry.year, entry.month)
    validationError = null
  })

  function submit() {
    // A cleared number input yields `null`, not NaN - see AGENTS.md.
    if (Number.isNaN(amount) || amount === null) {
      validationError = 'Enter an amount'
      return
    }
    validationError = null
    onSubmit({ amount })
  }
</script>

<ResponsiveFormSheet {open} {onOpenChange} title="Edit the {label} payment">
  <form
    id="outgoing-history-edit-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="outgoing-history-amount"
        >Amount</label
      >
      <Input id="outgoing-history-amount" type="number" step="0.01" min="0" bind:value={amount} />
    </div>
  </form>

  {#snippet footer()}
    {#if validationError ?? error}
      <p class="text-over mr-auto text-sm">{validationError ?? error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="outgoing-history-edit-form" disabled={submitting}>
      {submitting ? 'Saving…' : 'Save changes'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
