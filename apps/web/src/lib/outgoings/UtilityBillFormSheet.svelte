<script lang="ts" module>
  export interface UtilityBillFormValues {
    amount: number
    receivedOn: string | null
  }
</script>

<script lang="ts">
  import type { UtilityBill } from '$lib/api/utilities'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Label for the month this bill covers, e.g. "Jul 2026" - used in the title. */
    monthLabel: string
    /** The bill being edited, or null when adding. */
    bill: UtilityBill | null
    submitting: boolean
    error?: string | null
    onSubmit: (values: UtilityBillFormValues) => void
  }

  let { open, onOpenChange, monthLabel, bill, submitting, error, onSubmit }: Props = $props()

  let amount = $state<number>(NaN)
  let receivedOn = $state('')
  let validationError = $state<string | null>(null)
  // Snapshotted (not `$derived` off `bill`/`monthLabel`) so the title/submit
  // label don't collapse to "Add  bill" mid-close when the caller nulls the
  // target month as soon as `onOpenChange(false)` fires, while the sheet is
  // still animating out.
  let isEdit = $state(false)
  let titleMonthLabel = $state('')

  // Re-seed the draft whenever the sheet opens for a (possibly new) bill.
  $effect(() => {
    if (!open) return
    isEdit = bill !== null
    titleMonthLabel = monthLabel
    amount = bill?.amount ?? NaN
    receivedOn = bill?.receivedOn ? bill.receivedOn.slice(0, 10) : ''
    validationError = null
  })

  function submit() {
    // A cleared number input yields `null`, not NaN - see AGENTS.md.
    if (Number.isNaN(amount) || amount === null) {
      validationError = 'Enter a valid amount'
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      validationError = 'Enter a valid amount'
      return
    }
    validationError = null
    onSubmit({ amount, receivedOn: receivedOn === '' ? null : receivedOn })
  }
</script>

<ResponsiveFormSheet
  {open}
  {onOpenChange}
  title={isEdit ? `Edit ${titleMonthLabel} bill` : `Add ${titleMonthLabel} bill`}
>
  <form
    id="utility-bill-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="utility-bill-amount"
        >Amount</label
      >
      <Input id="utility-bill-amount" type="number" step="0.01" min="0" bind:value={amount} />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="utility-bill-received-on"
        >Received</label
      >
      <Input id="utility-bill-received-on" type="date" bind:value={receivedOn} />
    </div>
  </form>

  {#snippet footer()}
    {#if validationError ?? error}
      <p class="text-over mr-auto text-sm">{validationError ?? error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="utility-bill-form" disabled={submitting}>
      {submitting ? 'Saving…' : isEdit ? 'Save changes' : `Add ${titleMonthLabel} bill`}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
