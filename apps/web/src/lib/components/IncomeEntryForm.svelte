<script lang="ts">
  import { untrack } from 'svelte'
  import type { IncomeSource } from '$lib/api/income'
  import type { UserSummary } from '$lib/api/users'
  import { todayISO } from '$lib/format'
  import { Button } from '$lib/components/ui/button'

  export interface IncomeEntryFormValues {
    incomeSourceId: number | null
    userId: number | null
    amount: number
    receivedOn: string | null
    note: string | null
    taxWithheld: boolean | null
  }

  interface Props {
    sources: IncomeSource[]
    users?: UserSummary[]
    allowUnattributed?: boolean
    submitting: boolean
    class?: string
    onSubmit: (values: IncomeEntryFormValues) => Promise<boolean>
    /** Set on the `<form>` so a caller's own footer button can submit it. */
    formId?: string
    /** Hide the form's own submit button - for when the caller renders one
        in a sheet/dialog footer instead (see MonthlyLogIncomeSheet). */
    showSubmit?: boolean
    // Pre-fill the received-on date with today (and re-default to it after a
    // successful submit). Kept opt-in because the Monthly page logs income
    // against a viewed month that may be in the past - stamping today's date
    // on those entries would contradict their year/month.
    defaultReceivedOnToday?: boolean
  }

  let {
    sources,
    users = [],
    allowUnattributed = false,
    submitting,
    class: className = 'flex flex-wrap items-end gap-3',
    onSubmit,
    formId,
    showSubmit = true,
    defaultReceivedOnToday = false,
  }: Props = $props()

  function defaultSourceId(): string {
    if (allowUnattributed) return ''
    return sources[0]?.id !== undefined ? String(sources[0].id) : ''
  }

  let userId = $state('')
  let sourceId = $state(defaultSourceId())
  let amount = $state<number>(NaN)
  // `untrack` because this is a mount-time snapshot of the prop (the form is
  // freshly mounted whenever its parent reveals it), not a live binding.
  let receivedOn = $state(untrack(() => (defaultReceivedOnToday ? todayISO() : '')))
  let note = $state('')
  let taxWithheld = $state(false)

  // Once a person is picked, the Source dropdown narrows to that person's own
  // sources - showing every household member's sources in one list let you
  // attribute an entry to the wrong person's source with nothing to catch it.
  // Until a person is chosen there's nothing to scope the list to, so it's
  // just "Other".
  const availableSources = $derived(
    allowUnattributed ? sources.filter((s) => s.userId === Number(userId)) : sources
  )

  // With a single source there's nothing to choose - hide the dropdown and
  // attribute to it automatically. Only applies when "Other" isn't an option
  // (allowUnattributed false); with it, the person's source competes against
  // "Other" and still needs the picker.
  const singleSource = $derived(!allowUnattributed && sources.length === 1 ? sources[0] : null)

  function reset() {
    userId = ''
    sourceId = defaultSourceId()
    amount = NaN
    receivedOn = defaultReceivedOnToday ? todayISO() : ''
    note = ''
    taxWithheld = false
  }

  // Changing person invalidates whatever source was picked for the previous
  // person - reset to Other rather than silently keeping a now-hidden
  // selection.
  function handlePersonChange() {
    sourceId = ''
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    const unattributed = allowUnattributed && sourceId === ''
    const ok = await onSubmit({
      incomeSourceId: singleSource ? singleSource.id : unattributed ? null : Number(sourceId),
      userId: unattributed ? (userId === '' ? null : Number(userId)) : null,
      amount,
      receivedOn: receivedOn === '' ? null : receivedOn,
      note: note.trim() === '' ? null : note.trim(),
      taxWithheld: unattributed ? taxWithheld : null,
    })
    if (ok) reset()
  }
</script>

<form id={formId} onsubmit={handleSubmit} class={className}>
  {#if allowUnattributed}
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Person</span>
      <select
        bind:value={userId}
        onchange={handlePersonChange}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">Select person</option>
        {#each users as u (u.id)}
          <option value={String(u.id)}>{u.fullName ?? u.email}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if !singleSource}
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Source</span>
      <select
        bind:value={sourceId}
        class="min-w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {#if allowUnattributed}
          <option value="">Other</option>
        {/if}
        {#each availableSources as source (source.id)}
          <option value={String(source.id)}>{source.name}</option>
        {/each}
      </select>
    </label>
  {/if}
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Received on</span>
    <input
      type="date"
      bind:value={receivedOn}
      class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</span>
    <input
      type="number"
      step="0.01"
      min="0"
      bind:value={amount}
      class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Note</span>
    <input
      type="text"
      placeholder="optional"
      bind:value={note}
      class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  </label>
  {#if allowUnattributed && sourceId === ''}
    <label class="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500 dark:text-slate-400">
      <input
        type="checkbox"
        bind:checked={taxWithheld}
        class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
      />
      Tax withheld
    </label>
  {/if}
  {#if showSubmit}
    <Button type="submit" disabled={submitting || (!allowUnattributed && sources.length === 0)}>
      {submitting ? 'Logging…' : 'Log income'}
    </Button>
  {/if}
</form>
