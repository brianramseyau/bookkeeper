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
  class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
>
  {@render leading()}
  <td class={[cellClass, 'text-right']}>
    <input
      type="number"
      step="0.01"
      min="0"
      bind:value={amount}
      class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
  </td>
  <td class={cellClass}>
    <input
      type="date"
      bind:value={receivedOn}
      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
  </td>
  <td class={cellClass}>
    <input
      type="text"
      bind:value={note}
      class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    />
  </td>
  <td class={lastCellClass}>
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
