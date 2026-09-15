<script lang="ts" module>
  import type { IncomeEntry, IncomeSource } from '$lib/api/income'

  export type IncomeEntryEditTarget =
    | { type: 'entry'; entry: IncomeEntry }
    | {
        type: 'placeholder'
        sourceId: number | null
        label: string
        date: string
        projectedAmount: number
      }
    | {
        /** Logging a brand-new entry - a salary one against a chosen source,
            or an unattributed "other income" item against a person. */
        type: 'new'
        kind: 'salary' | 'other'
        /** Candidate sources for a salary entry. */
        sources: IncomeSource[]
        userId: number | null
        /** Default received-on date, e.g. today. */
        receivedOn: string
      }

  export interface IncomeEntryEditValues {
    userId: number | null
    incomeSourceId: number | null
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
    /** The entry being edited, the placeholder pay date being logged, or the
        new entry being added - null only while the sheet is closed. */
    target: IncomeEntryEditTarget | null
    users: UserSummary[]
    submitting: boolean
    error?: string | null
    onSave: (values: IncomeEntryEditValues) => void
  }

  let { open, onOpenChange, target, users, submitting, error, onSave }: Props = $props()

  // A placeholder pay date and a salary entry both belong to a known income
  // source, so they never need the owner/tax fields an unattributed entry
  // (or an "other income" item being added) does.
  const unattributed = $derived(
    (target?.type === 'entry' && target.entry.incomeSourceId === null) ||
      (target?.type === 'new' && target.kind === 'other')
  )
  const showSource = $derived(target?.type === 'new' && target.kind === 'salary')

  let userId = $state('')
  let sourceId = $state('')
  let taxWithheld = $state(false)
  let amount = $state<number>(NaN)
  let receivedOn = $state('')
  let note = $state('')

  // Re-seed the draft whenever the sheet opens for a (possibly new) target,
  // mirroring OutgoingFormSheet's own re-seed effect.
  $effect(() => {
    if (!open || !target) return
    if (target.type === 'entry') {
      const entry = target.entry
      userId = entry.userId !== null ? String(entry.userId) : ''
      sourceId = ''
      taxWithheld = entry.taxWithheld ?? false
      amount = entry.amount
      receivedOn = entry.receivedOn ? entry.receivedOn.slice(0, 10) : ''
      note = entry.note ?? ''
    } else if (target.type === 'new') {
      userId = target.userId !== null ? String(target.userId) : ''
      sourceId = target.sources[0] !== undefined ? String(target.sources[0].id) : ''
      taxWithheld = false
      amount = NaN
      receivedOn = target.receivedOn.slice(0, 10)
      note = ''
    } else {
      userId = ''
      sourceId = ''
      taxWithheld = false
      amount = target.projectedAmount
      receivedOn = target.date.slice(0, 10)
      note = ''
    }
  })

  function submit() {
    const incomeSourceId =
      target?.type === 'entry'
        ? target.entry.incomeSourceId
        : target?.type === 'placeholder'
          ? target.sourceId
          : target?.type === 'new' && target.kind === 'salary' && sourceId !== ''
            ? Number(sourceId)
            : null
    onSave({
      userId: userId === '' ? null : Number(userId),
      incomeSourceId,
      taxWithheld,
      amount,
      receivedOn,
      note: note.trim(),
    })
  }

  const title = $derived.by(() => {
    if (target?.type === 'entry') return `Edit ${entryRowLabel(target.entry)}`
    if (target?.type === 'placeholder') return 'Log projected pay'
    if (target?.type === 'new') return target.kind === 'salary' ? 'Log salary' : 'Add other income'
    return 'Income entry'
  })
  const description = $derived(
    target?.type === 'placeholder'
      ? `Projected for ${formatDate(target.date)} - ${target.label}.`
      : undefined
  )
  const submitLabel = $derived(
    target?.type === 'new' ? (target.kind === 'salary' ? 'Log entry' : 'Add entry') : 'Save changes'
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
    {#if showSource}
      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-xs font-medium" for="entry-edit-source"
          >Source</label
        >
        <select
          id="entry-edit-source"
          class="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          bind:value={sourceId}
        >
          <option value="">Select source</option>
          {#each target?.type === 'new' ? target.sources : [] as source (source.id)}
            <option value={String(source.id)}>{source.name}</option>
          {/each}
        </select>
      </div>
    {/if}
    {#if unattributed}
      <div class="flex flex-col gap-1">
        <label class="text-muted-foreground text-xs font-medium" for="entry-edit-owner">Owner</label
        >
        <select
          id="entry-edit-owner"
          class="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          bind:value={userId}
        >
          <option value="">Select person</option>
          {#each users as u (u.id)}
            <option value={String(u.id)}>{u.fullName ?? u.email}</option>
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
      {submitting ? 'Saving…' : submitLabel}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
