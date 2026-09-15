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
    /** Extra `<td>`(s) after the Amount column, e.g. Income's Tax
        withheld/Tax/Gain columns. */
    trailing?: Snippet<[IncomeEntry]>
    /** Set false when the caller's leading cell already carries the note
        (Income's Item column does), so it isn't shown twice. */
    showNote?: boolean
    /** The amount column's under-`sm` label - Monthly reads it as "Actual",
        Income's own header calls the same figure "Amount". */
    amountLabel?: string
    onEdit: (entry: IncomeEntry) => void
    onDelete: (entry: IncomeEntry) => void
  }

  let {
    entry,
    leading,
    projected,
    trailing,
    showNote = true,
    amountLabel = 'Actual',
    onEdit,
    onDelete,
  }: Props = $props()
</script>

<tr
  class="divide-border border-border bg-card mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
>
  {@render leading?.(entry)}
  <td
    class="text-muted-foreground flex min-h-9 items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:min-h-0"
  >
    <span class="font-figures min-w-0 truncate">{formatDate(entry.receivedOn)}</span>
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
      class="text-muted-foreground font-figures flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
    >
      <span class="shrink-0 text-xs font-medium sm:hidden">Projected</span>
      {formatCurrency(projected)}
    </td>
  {/if}
  <td
    class="text-foreground font-figures flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
  >
    <span class="text-muted-foreground shrink-0 text-xs font-medium sm:hidden">{amountLabel}</span>
    {formatCurrency(entry.amount)}
  </td>
  {#if showNote}
    <td
      class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell"
    >
      <span class="shrink-0 text-xs font-medium sm:hidden">Note</span>
      {entry.note ?? '—'}
    </td>
  {/if}
  {@render trailing?.(entry)}
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
