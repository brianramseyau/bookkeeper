<script lang="ts">
  import type { StandardMonthLine } from '$lib/api/standard-month'
  import { formatCurrency } from '$lib/format'
  import {
    dueLabel,
    dueTitle,
    dueChipClass,
    canTrackPaid,
    actualIsAssumed,
    paidTooltip,
    viewHref,
  } from '$lib/standard-month-line'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import HelpTooltip from '$lib/components/HelpTooltip.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete } from '@mdi/js'

  export type ExpenseEditMode =
    | 'utility'
    | 'recurring-bill'
    | 'subscription'
    | 'expense-add'
    | 'expense-edit'
    | 'expense-multiple'

  interface Props {
    year: number
    month: number
    lines: StandardMonthLine[]
    projectedTotal: number
    actualTotal: number
    editingExpenseKey: string | null
    editExpenseMode: ExpenseEditMode | null
    editActualsExpenseId: number | null
    editExpenseAmount: number
    editExpenseReceivedOn: string
    savingExpense: boolean
    savingPaidKey: string | null
    onStartEdit: (line: StandardMonthLine) => void
    onCancelEdit: () => void
    onSaveEdit: () => void
    onRemoveActual: () => void
    onTogglePaid: (line: StandardMonthLine, paid: boolean) => void
  }

  let {
    year,
    month,
    lines,
    projectedTotal,
    actualTotal,
    editingExpenseKey,
    editExpenseMode,
    editActualsExpenseId,
    editExpenseAmount = $bindable(),
    editExpenseReceivedOn = $bindable(),
    savingExpense,
    savingPaidKey,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onRemoveActual,
    onTogglePaid,
  }: Props = $props()
</script>

<Card class="mt-3 sm:overflow-x-auto" pivotTable>
  <table class="block w-full border-collapse text-sm sm:table">
    <thead class="hidden sm:table-header-group">
      <tr class="border-b border-slate-200 dark:border-slate-700">
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Line</th>
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Due</th>
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
          >Projected</th
        >
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Actual</th
        >
        <th class="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400">Paid</th>
        <th class="px-3 py-2"></th>
      </tr>
    </thead>
    <tbody class="block sm:table-row-group">
      {#each lines as line (line.key)}
        {@const editable =
          (line.key.startsWith('utility-') && line.editable) ||
          line.key.startsWith('recurring-bill-') ||
          line.key.startsWith('subscription-') ||
          line.key.startsWith('expense-')}
        {#if editingExpenseKey === line.key}
          <tr
            class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
          >
            <td
              class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
            >
              <span class="min-w-0 truncate">
                {#if viewHref(line)}
                  <a
                    href={viewHref(line)}
                    class="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                  >
                    {line.label}
                  </a>
                {:else}
                  {line.label}
                {/if}
              </span>
              <span class="flex shrink-0 items-center gap-1 sm:hidden">
                {#if editExpenseMode === 'expense-multiple'}
                  <a
                    href="/expenses/{editActualsExpenseId}"
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    View all →
                  </a>
                {:else}
                  <IconActionButton
                    variant="primary"
                    disabled={savingExpense}
                    label="Save {line.label}"
                    path={mdiContentSave}
                    onclick={onSaveEdit}
                  />
                  {#if editExpenseMode === 'expense-edit'}
                    <IconActionButton
                      variant="danger"
                      label="Delete {line.label} entry"
                      path={mdiDelete}
                      onclick={onRemoveActual}
                    />
                  {/if}
                {/if}
                <IconActionButton
                  variant="cancel"
                  label="Cancel editing {line.label}"
                  path={mdiCloseThick}
                  onclick={onCancelEdit}
                />
              </span>
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
              title={editExpenseMode === 'utility' ? undefined : dueTitle(line, year, month)}
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >{editExpenseMode === 'utility' ? 'Received' : 'Due'}</span
              >
              {#if editExpenseMode === 'utility'}
                <input
                  type="date"
                  bind:value={editExpenseReceivedOn}
                  class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              {:else if dueChipClass(line, year, month)}
                <span
                  class={[
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    dueChipClass(line, year, month),
                  ]}>{dueLabel(line, year, month)}</span
                >
              {:else}
                {dueLabel(line, year, month)}
              {/if}
            </td>
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
              class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Actual</span
              >
              {#if editExpenseMode === 'expense-multiple'}
                <span class="text-xs text-slate-500 dark:text-slate-400">Multiple entries</span>
              {:else}
                <input
                  type="number"
                  step="0.01"
                  bind:value={editExpenseAmount}
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              {/if}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-center"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Paid</span
              >
              <input
                type="checkbox"
                checked={line.paid}
                disabled={savingPaidKey === line.key || !canTrackPaid(line, year, month)}
                onchange={(e) => onTogglePaid(line, e.currentTarget.checked)}
                aria-label="Paid"
                title={paidTooltip(line, year, month)}
                class={[
                  'h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600',
                  line.estimated ? 'text-amber-500 dark:text-amber-400' : 'text-indigo-600',
                ]}
              />
            </td>
            <td
              class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
            >
              {#if editExpenseMode === 'expense-multiple'}
                <a
                  href="/expenses/{editActualsExpenseId}"
                  class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  View all →
                </a>
              {:else}
                <IconActionButton
                  variant="primary"
                  disabled={savingExpense}
                  label="Save {line.label}"
                  path={mdiContentSave}
                  onclick={onSaveEdit}
                />
                {#if editExpenseMode === 'expense-edit'}
                  <IconActionButton
                    variant="danger"
                    label="Delete {line.label} entry"
                    path={mdiDelete}
                    onclick={onRemoveActual}
                  />
                {/if}
              {/if}
              <IconActionButton
                variant="cancel"
                label="Cancel editing {line.label}"
                path={mdiCloseThick}
                onclick={onCancelEdit}
              />
            </td>
          </tr>
        {:else}
          <tr
            class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
          >
            <td
              class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
            >
              <span class="min-w-0 truncate">
                {#if viewHref(line)}
                  <a
                    href={viewHref(line)}
                    class="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                  >
                    {line.label}
                  </a>
                {:else}
                  {line.label}
                {/if}
              </span>
              {#if editable}
                <span class="flex shrink-0 items-center gap-1 sm:hidden">
                  <IconActionButton
                    variant="neutral"
                    label="Edit {line.label}"
                    path={mdiPencil}
                    onclick={() => onStartEdit(line)}
                  />
                </span>
              {/if}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
              title={dueTitle(line, year, month)}
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Due</span
              >
              {#if dueChipClass(line, year, month)}
                <span
                  class={[
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    dueChipClass(line, year, month),
                  ]}>{dueLabel(line, year, month)}</span
                >
              {:else if line.dueDateEstimated}
                <span
                  >{dueLabel(line, year, month)}<span
                    class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500">(est.)</span
                  ></span
                >
              {:else}
                {dueLabel(line, year, month)}
              {/if}
            </td>
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
              class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Actual</span
              >
              <span>
                <span
                  class={[
                    actualIsAssumed(line) &&
                      'font-medium text-amber-600 italic dark:text-amber-400',
                  ]}
                >
                  {formatCurrency(line.actual)}
                </span>
                {#if actualIsAssumed(line)}
                  <HelpTooltip
                    label="Why is {line.label}'s actual amount estimated?"
                    text="No record for this month this far back - showing today's live amount, not necessarily what was actually charged then."
                  />
                {/if}
              </span>
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-center"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Paid</span
              >
              <input
                type="checkbox"
                checked={line.paid}
                disabled={savingPaidKey === line.key || !canTrackPaid(line, year, month)}
                onchange={(e) => onTogglePaid(line, e.currentTarget.checked)}
                aria-label="Paid"
                title={paidTooltip(line, year, month)}
                class={[
                  'h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600',
                  line.estimated ? 'text-amber-500 dark:text-amber-400' : 'text-indigo-600',
                ]}
              />
            </td>
            <td
              class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
            >
              {#if editable}
                <IconActionButton
                  variant="neutral"
                  label="Edit {line.label}"
                  path={mdiPencil}
                  onclick={() => onStartEdit(line)}
                />
              {/if}
            </td>
          </tr>
        {/if}
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
        <td class="hidden px-3 py-2 sm:table-cell"></td>
        <td class="hidden px-3 py-2 sm:table-cell"></td>
      </tr>
    </tfoot>
  </table>
</Card>
