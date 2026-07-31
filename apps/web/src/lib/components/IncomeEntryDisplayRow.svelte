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

<tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
  {@render leading()}
  <td class={[cellClass, 'text-right', amountValueClass]}>{formatCurrency(amount)}</td>
  <td class={[cellClass, 'text-slate-500 dark:text-slate-400']}>{formatDate(receivedOn)}</td>
  <td class={[cellClass, 'text-slate-500 dark:text-slate-400']}>{note ?? '—'}</td>
  <td class={lastCellClass}>
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
