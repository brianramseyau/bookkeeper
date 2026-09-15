<script lang="ts">
  import type { StandardMonthIncomeLine } from '$lib/api/standard-month'
  import type { IncomeEntry } from '$lib/api/income'
  import type { UserSummary } from '$lib/api/users'
  import { type IncomeRow, incomeRowsForLine, entryRowLabel } from '$lib/income-rows'
  import { formatCurrency, formatDate } from '$lib/format'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete, mdiCheckBold } from '@mdi/js'

  interface Props {
    lines: StandardMonthIncomeLine[]
    entries: IncomeEntry[]
    users: UserSummary[]
    projectedTotal: number
    actualTotal: number
    editingEntryId: number | null
    editEntryUserId: string
    editEntryTaxWithheld: boolean
    editEntryAmount: number
    editEntryReceivedOn: string
    editEntryNote: string
    savingEntryEdit: boolean
    editingPlaceholderKey: string | null
    editPlaceholderAmount: number
    editPlaceholderReceivedOn: string
    editPlaceholderNote: string
    savingPlaceholderEdit: boolean
    acceptingPlaceholderKey: string | null
    onStartEditEntry: (entry: IncomeEntry) => void
    onCancelEditEntry: () => void
    onSaveEditEntry: (entry: IncomeEntry) => void
    onDeleteEntry: (entry: IncomeEntry) => void
    onStartEditPlaceholder: (row: Extract<IncomeRow, { type: 'placeholder' }>) => void
    onCancelEditPlaceholder: () => void
    onSavePlaceholder: (line: StandardMonthIncomeLine) => void
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
    editingEntryId,
    editEntryUserId = $bindable(),
    editEntryTaxWithheld = $bindable(),
    editEntryAmount = $bindable(),
    editEntryReceivedOn = $bindable(),
    editEntryNote = $bindable(),
    savingEntryEdit,
    editingPlaceholderKey,
    editPlaceholderAmount = $bindable(),
    editPlaceholderReceivedOn = $bindable(),
    editPlaceholderNote = $bindable(),
    savingPlaceholderEdit,
    acceptingPlaceholderKey,
    onStartEditEntry,
    onCancelEditEntry,
    onSaveEditEntry,
    onDeleteEntry,
    onStartEditPlaceholder,
    onCancelEditPlaceholder,
    onSavePlaceholder,
    onAcceptPlaceholder,
  }: Props = $props()
</script>

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
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
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
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Projected</span
            >
            {formatCurrency(line.projected)}
          </td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Actual</span
            >
            <span>
              {formatCurrency(line.actual)}
              {#if line.estimated}
                <span
                  class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500"
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
            {@const entry = row.entry}
            {#if editingEntryId === entry.id}
              <tr
                class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
              >
                {#if entry.incomeSourceId === null}
                  <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Owner</span
                    >
                    <select
                      bind:value={editEntryUserId}
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-auto dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select person</option>
                      {#each users as u (u.id)}
                        <option value={u.id}>{u.fullName ?? u.email}</option>
                      {/each}
                    </select>
                  </td>
                  <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                    <label
                      class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                    >
                      <input
                        type="checkbox"
                        bind:checked={editEntryTaxWithheld}
                        class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                      />
                      Withheld
                    </label>
                  </td>
                {:else}
                  <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
                {/if}
                <td class="block px-3 py-2 sm:table-cell">
                  <div class="mb-1 flex items-center justify-between gap-3 sm:hidden">
                    <span class="text-xs font-medium text-slate-400 uppercase dark:text-slate-500"
                      >Date</span
                    >
                    <span class="flex shrink-0 items-center gap-1">
                      <IconActionButton
                        variant="primary"
                        disabled={savingEntryEdit}
                        label="Save income entry"
                        path={mdiContentSave}
                        onclick={() => onSaveEditEntry(entry)}
                      />
                      <IconActionButton
                        variant="cancel"
                        label="Cancel editing income entry"
                        path={mdiCloseThick}
                        onclick={onCancelEditEntry}
                      />
                    </span>
                  </div>
                  <input
                    type="date"
                    bind:value={editEntryReceivedOn}
                    class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Projected</span
                  >
                  {formatCurrency(row.projected)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Actual</span
                  >
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={editEntryAmount}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Note</span
                  >
                  <input
                    type="text"
                    bind:value={editEntryNote}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="primary"
                    disabled={savingEntryEdit}
                    label="Save income entry"
                    path={mdiContentSave}
                    onclick={() => onSaveEditEntry(entry)}
                  />
                  <IconActionButton
                    variant="cancel"
                    label="Cancel editing income entry"
                    path={mdiCloseThick}
                    onclick={onCancelEditEntry}
                  />
                </td>
              </tr>
            {:else}
              <tr
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
              >
                {#if entry.incomeSourceId === null}
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Owner</span
                    >
                    {users.find((u) => u.id === entry.userId)?.fullName ?? '—'}
                  </td>
                  <td class="hidden px-3 py-2 sm:table-cell"></td>
                {:else}
                  <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
                {/if}
                <td
                  class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:min-h-0 dark:text-slate-400"
                >
                  <span class="min-w-0 truncate">{formatDate(entry.receivedOn)}</span>
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {entryRowLabel(entry)}"
                      path={mdiPencil}
                      onclick={() => onStartEditEntry(entry)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {entryRowLabel(entry)}"
                      path={mdiDelete}
                      onclick={() => onDeleteEntry(entry)}
                    />
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Projected</span
                  >
                  {formatCurrency(row.projected)}
                </td>
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
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="neutral"
                    label="Edit {entryRowLabel(entry)}"
                    path={mdiPencil}
                    onclick={() => onStartEditEntry(entry)}
                  />
                  <IconActionButton
                    variant="danger"
                    label="Delete {entryRowLabel(entry)}"
                    path={mdiDelete}
                    onclick={() => onDeleteEntry(entry)}
                  />
                </td>
              </tr>
            {/if}
          {:else if editingPlaceholderKey === row.key}
            <tr
              class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
            >
              <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
              <td class="block px-3 py-2 sm:table-cell">
                <div class="mb-1 flex items-center justify-between gap-3 sm:hidden">
                  <span class="text-xs font-medium text-slate-400 uppercase dark:text-slate-500"
                    >Date</span
                  >
                  <span class="flex shrink-0 items-center gap-1">
                    <IconActionButton
                      variant="primary"
                      disabled={savingPlaceholderEdit}
                      label="Save income entry"
                      path={mdiContentSave}
                      onclick={() => onSavePlaceholder(line)}
                    />
                    <IconActionButton
                      variant="cancel"
                      label="Cancel editing income entry"
                      path={mdiCloseThick}
                      onclick={onCancelEditPlaceholder}
                    />
                  </span>
                </div>
                <input
                  type="date"
                  bind:value={editPlaceholderReceivedOn}
                  class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Projected</span
                >
                {formatCurrency(row.projected)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Actual</span
                >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editPlaceholderAmount}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Note</span
                >
                <input
                  type="text"
                  bind:value={editPlaceholderNote}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td
                class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                <IconActionButton
                  variant="primary"
                  disabled={savingPlaceholderEdit}
                  label="Save income entry"
                  path={mdiContentSave}
                  onclick={() => onSavePlaceholder(line)}
                />
                <IconActionButton
                  variant="cancel"
                  label="Cancel editing income entry"
                  path={mdiCloseThick}
                  onclick={onCancelEditPlaceholder}
                />
              </td>
            </tr>
          {:else}
            <tr
              class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white italic last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
            >
              <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
              <td
                class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:min-h-0 dark:text-slate-500"
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
                    onclick={() => onStartEditPlaceholder(row)}
                  />
                </span>
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Projected</span
                >
                {formatCurrency(row.projected)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Actual</span
                >
                —
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell dark:text-slate-500"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
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
                  onclick={() => onStartEditPlaceholder(row)}
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
            class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
            >Projected</span
          >
          {formatCurrency(projectedTotal)}
        </td>
        <td
          class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
        >
          <span
            class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
            >Actual</span
          >
          {formatCurrency(actualTotal)}
        </td>
        <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
      </tr>
    </tfoot>
  </table>
</Card>
