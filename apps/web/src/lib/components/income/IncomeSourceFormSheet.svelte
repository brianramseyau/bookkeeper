<script lang="ts" module>
  import type { IncomeSourceFrequency } from '$lib/api/income'

  export interface IncomeSourceFormValues {
    name: string
    expectedAmount: number
    frequency: IncomeSourceFrequency
    payDayOfMonth: number | null
    weekendRollback: boolean
    anchorDate: string | null
    taxWithheld: boolean
  }
</script>

<script lang="ts">
  import type { IncomeSource } from '$lib/api/income'
  import { round2 } from '$lib/format'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  const FREQUENCIES: { value: IncomeSourceFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'fortnightly', label: 'Fortnightly' },
  ]

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The source being edited, or null when adding. */
    source: IncomeSource | null
    submitting: boolean
    error?: string | null
    onSubmit: (values: IncomeSourceFormValues) => void
  }

  let { open, onOpenChange, source, submitting, error, onSubmit }: Props = $props()

  let name = $state('')
  let expectedAmount = $state<number>(NaN)
  let frequency = $state<IncomeSourceFrequency>('monthly')
  let payDayOfMonth = $state<number>(NaN)
  let weekendRollback = $state(false)
  let anchorDate = $state('')
  let taxWithheld = $state(true)
  let validationError = $state<string | null>(null)

  const isEdit = $derived(source !== null)

  // Re-seed the draft whenever the sheet opens for a (possibly new) source,
  // mirroring the other sheets' re-seed effects.
  $effect(() => {
    if (!open) return
    if (source) {
      name = source.name
      // The API can return a raw float (e.g. 3885.7200000000003) - round it
      // so the input doesn't show the noise.
      expectedAmount = round2(source.expectedAmount)
      frequency = source.frequency
      payDayOfMonth = source.payDayOfMonth ?? NaN
      weekendRollback = source.weekendRollback
      anchorDate = source.anchorDate ? source.anchorDate.slice(0, 10) : ''
      taxWithheld = source.taxWithheld
    } else {
      name = ''
      expectedAmount = NaN
      frequency = 'monthly'
      payDayOfMonth = NaN
      weekendRollback = false
      anchorDate = ''
      taxWithheld = true
    }
    validationError = null
  })

  function submit() {
    if (!name.trim()) {
      validationError = 'Enter a name'
      return
    }
    // A cleared number input yields `null`, not NaN - see AGENTS.md.
    if (Number.isNaN(expectedAmount) || expectedAmount === null) {
      validationError = 'Enter an expected amount'
      return
    }
    if (frequency === 'monthly' && (Number.isNaN(payDayOfMonth) || payDayOfMonth === null)) {
      validationError = 'Enter a pay day of the month'
      return
    }
    if (frequency === 'fortnightly' && !anchorDate) {
      validationError = 'Pick an anchor pay date'
      return
    }
    validationError = null
    onSubmit({
      name: name.trim(),
      expectedAmount,
      frequency,
      payDayOfMonth: frequency === 'monthly' ? payDayOfMonth : null,
      weekendRollback: frequency === 'monthly' ? weekendRollback : false,
      anchorDate: frequency === 'fortnightly' && anchorDate !== '' ? anchorDate : null,
      taxWithheld,
    })
  }
</script>

<ResponsiveFormSheet
  {open}
  {onOpenChange}
  title={isEdit ? `Edit ${source?.name}` : 'Add income source'}
>
  <form
    id="income-source-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="income-source-name">Name</label>
      <Input id="income-source-name" type="text" placeholder="e.g. Salary" bind:value={name} />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="income-source-amount"
        >Expected per pay</label
      >
      <Input
        id="income-source-amount"
        type="number"
        step="0.01"
        min="0"
        bind:value={expectedAmount}
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="income-source-frequency"
        >Frequency</label
      >
      <select
        id="income-source-frequency"
        class="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        bind:value={frequency}
      >
        {#each FREQUENCIES as option (option.value)}
          <option value={String(option.value)}>{option.label}</option>
        {/each}
      </select>
    </div>
    {#if frequency === 'monthly'}
      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-xs font-medium" for="income-source-pay-day"
          >Pay day of month</label
        >
        <Input
          id="income-source-pay-day"
          type="number"
          min="1"
          max="31"
          bind:value={payDayOfMonth}
        />
      </div>
      <label class="flex items-center gap-2">
        <input type="checkbox" class="size-4 rounded" bind:checked={weekendRollback} />
        <span class="text-foreground text-sm font-medium"
          >Roll to the preceding Friday on a weekend</span
        >
      </label>
    {:else}
      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-xs font-medium" for="income-source-anchor"
          >A confirmed real pay date</label
        >
        <Input id="income-source-anchor" type="date" bind:value={anchorDate} />
      </div>
    {/if}
    <label class="flex items-center gap-2">
      <input type="checkbox" class="size-4 rounded" bind:checked={taxWithheld} />
      <span class="text-foreground text-sm font-medium">Tax withheld (PAYG)</span>
    </label>
  </form>

  {#snippet footer()}
    {#if validationError ?? error}
      <p class="text-over mr-auto text-sm">{validationError ?? error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="income-source-form" disabled={submitting}>
      {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add income source'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
