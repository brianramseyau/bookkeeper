<script lang="ts">
  import type { IncomeEntry, IncomeSource } from '$lib/api/income'
  import { entryGain, entryTax, type IncomeEntryTotals } from '$lib/income-entries'
  import { formatCurrency } from '$lib/format'
  import Card from '$lib/components/Card.svelte'
  import IncomeEntryDisplayRow from '$lib/components/IncomeEntryDisplayRow.svelte'

  interface Props {
    entries: IncomeEntry[]
    sources: IncomeSource[]
    /** The selected financial year's marginal rate, or null when none is set. */
    marginalRate: number | null
    totals: IncomeEntryTotals
    /** Whether any shown entry is "other income" - gates the footer's Tax/Gain. */
    hasOther: boolean
    emptyMessage: string
    onEdit: (entry: IncomeEntry) => void
    onDelete: (entry: IncomeEntry) => void
  }

  let { entries, sources, marginalRate, totals, hasOther, emptyMessage, onEdit, onDelete }: Props =
    $props()

  const sourceById = $derived(new Map(sources.map((s) => [s.id, s])))

  function sourceName(id: number | null): string {
    return sourceById.get(id ?? -1)?.name ?? 'Unknown'
  }

  function taxWithheld(entry: IncomeEntry): boolean {
    return entry.incomeSourceId !== null
      ? (sourceById.get(entry.incomeSourceId)?.taxWithheld ?? false)
      : (entry.taxWithheld ?? false)
  }
</script>

{#snippet itemLeading(entry: IncomeEntry)}
  <td
    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
  >
    {#if entry.incomeSourceId !== null}
      <div class="min-w-0">
        <div class="truncate">{sourceName(entry.incomeSourceId)}</div>
        {#if entry.note}
          <div class="mt-0.5 truncate text-xs font-normal text-slate-400 dark:text-slate-500">
            {entry.note}
          </div>
        {/if}
      </div>
    {:else}
      <span class="min-w-0 truncate">{entry.note ?? '—'}</span>
    {/if}
  </td>
{/snippet}

{#snippet taxCells(entry: IncomeEntry)}
  <td
    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Tax withheld</span
    >
    {taxWithheld(entry) ? 'Yes' : 'No'}
  </td>
  <td
    class={[
      'flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right',
      entry.incomeSourceId !== null
        ? 'text-slate-400 dark:text-slate-500'
        : 'text-slate-900 dark:text-slate-100',
    ]}
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Tax</span
    >
    {formatCurrency(entryTax(entry, marginalRate))}
  </td>
  <td
    class={[
      'flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right',
      entry.incomeSourceId !== null
        ? 'text-slate-400 dark:text-slate-500'
        : 'text-slate-900 dark:text-slate-100',
    ]}
  >
    <span
      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
      >Gain</span
    >
    {formatCurrency(entryGain(entry, marginalRate))}
  </td>
{/snippet}

<Card class="mt-3 sm:overflow-x-auto" pivotTable>
  <table class="block w-full border-collapse text-sm sm:table">
    <thead class="hidden sm:table-header-group">
      <tr class="border-b border-slate-200 dark:border-slate-700">
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Item</th>
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Amount</th
        >
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
          >Tax withheld</th
        >
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Tax</th>
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Gain</th>
        <th class="px-3 py-2"></th>
      </tr>
    </thead>
    <tbody class="block sm:table-row-group">
      {#each entries as entry (entry.id)}
        <IncomeEntryDisplayRow
          {entry}
          leading={itemLeading}
          trailing={taxCells}
          showNote={false}
          amountLabel="Amount"
          {onEdit}
          {onDelete}
        />
      {:else}
        <tr class="block sm:table-row">
          <td
            colspan="7"
            class="block px-3 py-6 text-center text-sm text-slate-400 sm:table-cell dark:text-slate-500"
          >
            {emptyMessage}
          </td>
        </tr>
      {/each}
    </tbody>
    <tfoot class="block sm:table-footer-group">
      <tr
        class="mt-1 block border-t border-slate-200 pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0 dark:border-slate-700"
      >
        <td class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100" colspan="2">Total</td
        >
        <td
          class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
        >
          <span
            class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
            >Amount</span
          >
          {formatCurrency(totals.amount)}
        </td>
        <td class="hidden px-3 py-2 sm:table-cell"></td>
        <td
          class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
        >
          <span
            class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
            >Tax</span
          >
          {hasOther ? formatCurrency(totals.tax) : '—'}
        </td>
        <td
          class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
        >
          <span
            class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
            >Gain</span
          >
          {hasOther ? formatCurrency(totals.gain) : '—'}
        </td>
        <td class="hidden px-3 py-2 sm:table-cell"></td>
      </tr>
    </tfoot>
  </table>
</Card>
