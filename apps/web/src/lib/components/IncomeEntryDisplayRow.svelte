<script lang="ts">
  import type { Snippet } from 'svelte'
  import { formatCurrency, formatDate } from '$lib/format'
  import IconActionButton from './IconActionButton.svelte'
  import { mdiPencil, mdiDelete } from '@mdi/js'

  interface Props {
    amount: number
    receivedOn: string | null
    note: string | null
    cellClass?: string
    lastCellClass?: string
    amountValueClass?: string
    leading: Snippet
    onEdit: () => void
    onRemove: () => void
  }

  let {
    amount,
    receivedOn,
    note,
    cellClass = 'px-3 py-2',
    lastCellClass = 'px-3 py-2 text-right whitespace-nowrap',
    amountValueClass = 'text-slate-700 dark:text-slate-300',
    leading,
    onEdit,
    onRemove,
  }: Props = $props()

  const entryLabel = $derived(receivedOn ? `entry from ${formatDate(receivedOn)}` : 'entry')
</script>

<tr
  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
>
  {@render leading()}
  <td
    class={[
      cellClass,
      'flex items-center justify-between gap-3 sm:table-cell sm:text-right',
      amountValueClass,
    ]}
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Amount</span
    >
    {formatCurrency(amount)}
  </td>
  <td
    class={[
      cellClass,
      'flex items-center justify-between gap-3 text-slate-500 sm:table-cell dark:text-slate-400',
    ]}
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Date</span
    >
    {formatDate(receivedOn)}
  </td>
  <td
    class={[
      cellClass,
      'flex items-center justify-between gap-3 text-slate-500 sm:table-cell dark:text-slate-400',
    ]}
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Note</span
    >
    {note ?? '—'}
  </td>
  <td class={[lastCellClass, 'flex justify-end gap-1 sm:table-cell']}>
    <IconActionButton
      variant="neutral"
      label="Edit {entryLabel}"
      path={mdiPencil}
      onclick={onEdit}
    />
    <IconActionButton
      variant="danger"
      label="Delete {entryLabel}"
      path={mdiDelete}
      onclick={onRemove}
    />
  </td>
</tr>
