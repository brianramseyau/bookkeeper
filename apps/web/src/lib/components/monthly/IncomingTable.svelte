<script lang="ts">
  import type { StandardMonthIncomeLine } from '$lib/api/standard-month'
  import type { IncomeEntry } from '$lib/api/income'
  import type { UserSummary } from '$lib/api/users'
  import { type IncomeRow, incomeRowsForLine } from '$lib/income-rows'
  import { formatCurrency, formatDate } from '$lib/format'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import IncomeEntryDisplayRow from '$lib/components/IncomeEntryDisplayRow.svelte'
  import { mdiPencil, mdiCheckBold } from '@mdi/js'

  interface Props {
    lines: StandardMonthIncomeLine[]
    entries: IncomeEntry[]
    users: UserSummary[]
    projectedTotal: number
    actualTotal: number
    acceptingPlaceholderKey: string | null
    onEditEntry: (entry: IncomeEntry) => void
    onDeleteEntry: (entry: IncomeEntry) => void
    onEditPlaceholder: (
      line: StandardMonthIncomeLine,
      row: Extract<IncomeRow, { type: 'placeholder' }>
    ) => void
    onAcceptPlaceholder: (
      line: StandardMonthIncomeLine,
      row: Extract<IncomeRow, { type: 'placeholder' }>
    ) => void
  }

  let {
    lines,
    entries,
    users,
    projectedTotal,
    actualTotal,
    acceptingPlaceholderKey,
    onEditEntry,
    onDeleteEntry,
    onEditPlaceholder,
    onAcceptPlaceholder,
  }: Props = $props()
</script>

{#snippet ownerLeading(entry: IncomeEntry)}
  {#if entry.incomeSourceId === null}
    <td
      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
    >
      <span
        class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
        >Owner</span
      >
      {users.find((u) => u.id === entry.userId)?.fullName ?? '—'}
    </td>
    <td class="hidden px-3 py-2 sm:table-cell"></td>
  {:else}
    <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
  {/if}
{/snippet}

<Card class="mt-3 sm:overflow-x-auto" pivotTable>
  <table class="block w-full border-collapse text-sm sm:table sm:table-fixed">
    <colgroup>
      <col class="sm:w-[12%]" />
      <col class="sm:w-[16%]" />
      <col class="sm:w-[14%]" />
      <col class="sm:w-[14%]" />
      <col class="sm:w-[14%]" />
      <col class="sm:w-[25%]" />
      <col class="sm:w-[5%]" />
    </colgroup>
    <thead class="hidden sm:table-header-group">
      <tr class="border-b border-slate-200 dark:border-slate-700">
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Owner</th>
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Source</th>
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
          >Projected</th
        >
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Actual</th
        >
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Note</th>
        <th class="px-3 py-2"></th>
      </tr>
    </thead>
    <tbody class="block sm:table-row-group">
      {#each lines as line (line.key)}
        <tr
          class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800/60 sm:dark:border-slate-700/60"
        >
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
          >
            <span
              class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
              >Owner</span
            >
            {line.userId !== null
              ? (users.find((u) => u.id === line.userId)?.fullName ?? '—')
              : '—'}
          </td>
          <td class="px-3 py-2 font-medium text-slate-900 sm:table-cell dark:text-slate-100"
            >{line.label}</td
          >
          <td class="hidden px-3 py-2 sm:table-cell"></td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
          >
            <span
              class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
              >Projected</span
            >
            {formatCurrency(line.projected)}
          </td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
              >Actual</span
            >
            <span>
              {formatCurrency(line.actual)}
              {#if line.estimated}
                <span
                  class="ml-1 text-xs font-normal text-muted-ink"
                  title="No entry logged this month - showing the projected amount"
                >
                  (est.)
                </span>
              {/if}
            </span>
          </td>
          <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
        </tr>
        {#each incomeRowsForLine(entries, line) as row (row.key)}
          {#if row.type === 'actual'}
            <IncomeEntryDisplayRow
              entry={row.entry}
              leading={ownerLeading}
              projected={row.projected}
              onEdit={onEditEntry}
              onDelete={onDeleteEntry}
            />
          {:else}
            <tr
              class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white italic last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
            >
              <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
              <td
                class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-muted-ink sm:table-cell sm:min-h-0"
              >
                <span class="min-w-0 truncate">{formatDate(row.date)}</span>
                <span class="flex shrink-0 items-center gap-1 not-italic sm:hidden">
                  <IconActionButton
                    variant="success"
                    disabled={acceptingPlaceholderKey === row.key}
                    label="Accept projected pay for {formatDate(row.date)}"
                    path={mdiCheckBold}
                    onclick={() => onAcceptPlaceholder(line, row)}
                  />
                  <IconActionButton
                    variant="neutral"
                    label="Edit projected pay for {formatDate(row.date)}"
                    path={mdiPencil}
                    onclick={() => onEditPlaceholder(line, row)}
                  />
                </span>
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-muted-ink sm:table-cell sm:text-right"
              >
                <span
                  class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
                  >Projected</span
                >
                {formatCurrency(row.projected)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-muted-ink sm:table-cell sm:text-right"
              >
                <span
                  class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
                  >Actual</span
                >
                —
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-muted-ink sm:table-cell"
              >
                <span
                  class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
                  >Note</span
                >
                Not yet logged
              </td>
              <td
                class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                <IconActionButton
                  variant="success"
                  disabled={acceptingPlaceholderKey === row.key}
                  label="Accept projected pay for {formatDate(row.date)}"
                  path={mdiCheckBold}
                  onclick={() => onAcceptPlaceholder(line, row)}
                />
                <IconActionButton
                  variant="neutral"
                  label="Edit projected pay for {formatDate(row.date)}"
                  path={mdiPencil}
                  onclick={() => onEditPlaceholder(line, row)}
                />
              </td>
            </tr>
          {/if}
        {/each}
      {/each}
    </tbody>
    <tfoot class="block sm:table-footer-group">
      <tr
        class="mt-1 block border-t border-slate-200 pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0 dark:border-slate-700"
      >
        <td class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100" colspan="2">Total</td
        >
        <td class="hidden px-3 py-2 sm:table-cell"></td>
        <td
          class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
        >
          <span
            class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
            >Projected</span
          >
          {formatCurrency(projectedTotal)}
        </td>
        <td
          class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
        >
          <span
            class="shrink-0 text-xs font-medium text-muted-ink uppercase sm:hidden"
            >Actual</span
          >
          {formatCurrency(actualTotal)}
        </td>
        <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
      </tr>
    </tfoot>
  </table>
</Card>
