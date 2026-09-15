<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { IncomeEntry } from '$lib/api/income'
  import { entryRowLabel } from '$lib/income-rows'
  import { formatCurrency, formatDate } from '$lib/format'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPencil, mdiDelete } from '@mdi/js'

  interface Props {
    entry: IncomeEntry
    /** Extra leading `<td>`(s) before the Date column, e.g. Monthly's Owner
        column - a page with nothing to add there (Income's own entries
        list) omits it entirely. */
    leading?: Snippet<[IncomeEntry]>
    /** An aligned "projected" figure column between Date and Actual - omit
        the prop entirely (not just pass `null`) to hide the column outright
        for a page with no per-pay-period projection to show it against. */
    projected?: number | null
    onEdit: (entry: IncomeEntry) => void
    onDelete: (entry: IncomeEntry) => void
  }

  let { entry, leading, projected, onEdit, onDelete }: Props = $props()
</script>

<tr
  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
>
  {@render leading?.(entry)}
  <td
    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:min-h-0 dark:text-slate-400"
  >
    <span class="min-w-0 truncate">{formatDate(entry.receivedOn)}</span>
    <span class="flex shrink-0 items-center gap-1 sm:hidden">
      <IconActionButton
        variant="neutral"
        label="Edit {entryRowLabel(entry)}"
        path={mdiPencil}
        onclick={() => onEdit(entry)}
      />
      <IconActionButton
        variant="danger"
        label="Delete {entryRowLabel(entry)}"
        path={mdiDelete}
        onclick={() => onDelete(entry)}
      />
    </span>
  </td>
  {#if projected !== undefined}
    <td
      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
    >
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Projected</span
      >
      {formatCurrency(projected)}
    </td>
  {/if}
  <td
    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-700 sm:table-cell sm:text-right dark:text-slate-300"
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Actual</span
    >
    {formatCurrency(entry.amount)}
  </td>
  <td
    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Note</span
    >
    {entry.note ?? '—'}
  </td>
  <td class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right">
    <IconActionButton
      variant="neutral"
      label="Edit {entryRowLabel(entry)}"
      path={mdiPencil}
      onclick={() => onEdit(entry)}
    />
    <IconActionButton
      variant="danger"
      label="Delete {entryRowLabel(entry)}"
      path={mdiDelete}
      onclick={() => onDelete(entry)}
    />
  </td>
</tr>
