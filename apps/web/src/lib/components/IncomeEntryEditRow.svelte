<script lang="ts">
  import { untrack, type Snippet } from 'svelte'
  import IconActionButton from './IconActionButton.svelte'
  import { mdiContentSave, mdiCloseThick } from '@mdi/js'

  export interface IncomeEntryEditUpdates {
    amount: number
    receivedOn: string | null
    note: string | null
  }

  interface Props {
    initialAmount: number
    initialReceivedOn: string
    initialNote: string
    saving: boolean
    cellClass?: string
    lastCellClass?: string
    leading: Snippet
    onSave: (updates: IncomeEntryEditUpdates) => void
    onCancel: () => void
  }

  let {
    initialAmount,
    initialReceivedOn,
    initialNote,
    saving,
    cellClass = 'px-3 py-2',
    lastCellClass = 'px-3 py-2 text-right whitespace-nowrap',
    leading,
    onSave,
    onCancel,
  }: Props = $props()

  // These are a one-time snapshot at mount, not a live binding to the
  // props - each edit row is freshly mounted when its entry's Edit button is
  // clicked (see the parent's `{#if editingEntryId === entry.id}` toggle),
  // so `untrack` here just silences Svelte's (inapplicable) "did you mean a
  // closure" warning rather than changing behavior.
  let amount = $state(untrack(() => initialAmount))
  let receivedOn = $state(untrack(() => initialReceivedOn))
  let note = $state(untrack(() => initialNote))

  function handleSave() {
    onSave({
      amount,
      receivedOn: receivedOn === '' ? null : receivedOn,
      note: note.trim() === '' ? null : note.trim(),
    })
  }
</script>

<tr
  class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
>
  {@render leading()}
  <td class={[cellClass, 'flex items-center justify-between gap-3 sm:table-cell sm:text-right']}>
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Amount</span
    >
    <input
      type="number"
      step="0.01"
      min="0"
      bind:value={amount}
      class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
  </td>
  <td class={[cellClass, 'flex items-center justify-between gap-3 sm:table-cell']}>
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Date</span
    >
    <input
      type="date"
      bind:value={receivedOn}
      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
  </td>
  <td class={[cellClass, 'flex items-center justify-between gap-3 sm:table-cell']}>
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Note</span
    >
    <input
      type="text"
      bind:value={note}
      class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
  </td>
  <td class={[lastCellClass, 'flex justify-end gap-1 sm:table-cell']}>
    <IconActionButton
      variant="primary"
      disabled={saving}
      label="Save income entry"
      path={mdiContentSave}
      onclick={handleSave}
    />
    <IconActionButton
      variant="cancel"
      label="Cancel editing income entry"
      path={mdiCloseThick}
      onclick={onCancel}
    />
  </td>
</tr>
