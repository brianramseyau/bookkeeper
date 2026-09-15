<script lang="ts" module>
  import type { IncomeEntry } from '$lib/api/income'

  export type IncomeEntryEditTarget =
    | { type: 'entry'; entry: IncomeEntry }
    | {
        type: 'placeholder'
        sourceId: number | null
        label: string
        date: string
        projectedAmount: number
      }

  export interface IncomeEntryEditValues {
    userId: number | null
    taxWithheld: boolean
    amount: number
    receivedOn: string
    note: string
  }
</script>

<script lang="ts">
  import type { UserSummary } from '$lib/api/users'
  import { entryRowLabel } from '$lib/income-rows'
  import { formatDate } from '$lib/format'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The entry being edited, or the placeholder pay date being logged -
        null only while the sheet is closed between targets. */
    target: IncomeEntryEditTarget | null
    users: UserSummary[]
    submitting: boolean
    error?: string | null
    onSave: (values: IncomeEntryEditValues) => void
  }

  let { open, onOpenChange, target, users, submitting, error, onSave }: Props = $props()

  // A placeholder pay date always belongs to a known income source (only
  // sourced lines carry `payDates`), so it never needs the owner/tax
  // fields an unattributed entry does.
  const unattributed = $derived(target?.type === 'entry' && target.entry.incomeSourceId === null)

  let userId = $state('')
  let taxWithheld = $state(false)
  let amount = $state<number>(NaN)
  let receivedOn = $state('')
  let note = $state('')

  // A `<select>` whose `<option>`s come from an `{#each}` block doesn't
  // reliably pick up a value set programmatically (bind:value, or a plain
  // `value={}`) on the same render pass its options are created - it stays
  // on the first option regardless, in this Svelte/jsdom combination
  // (reproduced in isolation outside this component too, unrelated to the
  // `$effect` below - even a value set synchronously at `$state`
  // declaration time hits it). Setting `.value` imperatively via a real
  // element reference sidesteps it; `bind:value` is kept alongside it so
  // the user's own selection still flows back into `userId` normally.
  let ownerSelectEl = $state<HTMLSelectElement | undefined>(undefined)
  $effect(() => {
    if (ownerSelectEl) ownerSelectEl.value = userId
  })

  // Re-seed the draft whenever the sheet opens for a (possibly new) target,
  // mirroring OutgoingFormSheet's own re-seed effect.
  $effect(() => {
    if (!open || !target) return
    if (target.type === 'entry') {
      const entry = target.entry
      userId = entry.userId !== null ? String(entry.userId) : ''
      taxWithheld = entry.taxWithheld ?? false
      amount = entry.amount
      receivedOn = entry.receivedOn ? entry.receivedOn.slice(0, 10) : ''
      note = entry.note ?? ''
    } else {
      userId = ''
      taxWithheld = false
      amount = target.projectedAmount
      receivedOn = target.date.slice(0, 10)
      note = ''
    }
  })

  function submit() {
    onSave({
      userId: userId === '' ? null : Number(userId),
      taxWithheld,
      amount,
      receivedOn,
      note: note.trim(),
    })
  }

  const title = $derived(
    target?.type === 'entry' ? `Edit ${entryRowLabel(target.entry)}` : 'Log projected pay'
  )
  const description = $derived(
    target?.type === 'placeholder'
      ? `Projected for ${formatDate(target.date)} - ${target.label}.`
      : undefined
  )
</script>

<ResponsiveFormSheet {open} {onOpenChange} {title} {description}>
  <form
    id="income-entry-edit-form"
    class="flex flex-col gap-4 py-2"
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
  >
    {#if unattributed}
      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-xs font-medium" for="entry-edit-owner">Owner</label
        >
        <select
          id="entry-edit-owner"
          bind:this={ownerSelectEl}
          class="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          bind:value={userId}
        >
          <option value="">Select person</option>
          {#each users as u (u.id)}
            <option value={u.id}>{u.fullName ?? u.email}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="entry-edit-received-on"
        >Received on</label
      >
      <Input id="entry-edit-received-on" type="date" bind:value={receivedOn} />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="entry-edit-amount">Amount</label
      >
      <Input id="entry-edit-amount" type="number" step="0.01" min="0" bind:value={amount} />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-muted-foreground text-xs font-medium" for="entry-edit-note">Note</label>
      <Input id="entry-edit-note" type="text" placeholder="optional" bind:value={note} />
    </div>
    {#if unattributed}
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          class="border-input accent-violet size-4 rounded"
          bind:checked={taxWithheld}
        />
        <span class="text-foreground text-sm font-medium">Tax withheld</span>
      </label>
    {/if}
  </form>

  {#snippet footer()}
    {#if error}
      <p class="text-over mr-auto text-sm">{error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="income-entry-edit-form" disabled={submitting}>
      {submitting ? 'Saving…' : 'Save changes'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
