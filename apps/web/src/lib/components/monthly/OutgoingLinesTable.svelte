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
  import { mdiPencil } from '@mdi/js'

  interface Props {
    year: number
    month: number
    lines: StandardMonthLine[]
    projectedTotal: number
    actualTotal: number
    savingPaidKey: string | null
    /** Opens the edit sheet for this line - see OutgoingLineEditSheet. */
    onStartEdit: (line: StandardMonthLine) => void
    onTogglePaid: (line: StandardMonthLine, paid: boolean) => void
  }

  let {
    year,
    month,
    lines,
    projectedTotal,
    actualTotal,
    savingPaidKey,
    onStartEdit,
    onTogglePaid,
  }: Props = $props()
</script>

<Card class="mt-3 sm:overflow-x-auto" pivotTable>
  <table class="block w-full border-collapse text-sm sm:table">
    <thead class="hidden sm:table-header-group">
      <tr class="border-border border-b">
        <th class="text-muted-foreground px-3 py-2 text-left font-medium">Line</th>
        <th class="text-muted-foreground px-3 py-2 text-left font-medium">Due</th>
        <th class="text-muted-foreground px-3 py-2 text-right font-medium">Projected</th>
        <th class="text-muted-foreground px-3 py-2 text-right font-medium">Actual</th>
        <th class="text-muted-foreground px-3 py-2 text-center font-medium">Paid</th>
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
        <tr
          class="divide-border border-border bg-card sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
        >
          <td
            class="text-foreground flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium sm:table-cell sm:min-h-0"
          >
            <span class="min-w-0 truncate">
              {#if viewHref(line)}
                <a href={viewHref(line)} class="hover:text-primary hover:underline">
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
            class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell"
            title={dueTitle(line, year, month)}
          >
            <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Due</span>
            {#if dueChipClass(line, year, month)}
              <span
                class={[
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  dueChipClass(line, year, month),
                ]}>{dueLabel(line, year, month)}</span
              >
            {:else if line.dueDateEstimated}
              <span
                >{dueLabel(line, year, month)}<span class="text-muted-ink ml-1 text-xs font-normal"
                  >(est.)</span
                ></span
              >
            {:else}
              {dueLabel(line, year, month)}
            {/if}
          </td>
          <td
            class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
          >
            <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Projected</span>
            {formatCurrency(line.projected)}
          </td>
          <td
            class="text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
          >
            <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Actual</span>
            <span>
              <span class={[actualIsAssumed(line) && 'text-due font-medium italic']}>
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
            <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Paid</span>
            <input
              type="checkbox"
              checked={line.paid}
              disabled={savingPaidKey === line.key || !canTrackPaid(line, year, month)}
              onchange={(e) => onTogglePaid(line, e.currentTarget.checked)}
              aria-label="Paid"
              title={paidTooltip(line, year, month)}
              class={[
                'border-input h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-40',
                line.estimated ? 'text-due' : 'text-primary',
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
      {/each}
    </tbody>
    <tfoot class="block sm:table-footer-group">
      <tr class="border-border mt-1 block border-t pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0">
        <td class="text-foreground px-3 py-2 sm:table-cell" colspan="2">Total</td>
        <td
          class="text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
        >
          <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Projected</span>
          {formatCurrency(projectedTotal)}
        </td>
        <td
          class="text-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
        >
          <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Actual</span>
          {formatCurrency(actualTotal)}
        </td>
        <td class="hidden px-3 py-2 sm:table-cell"></td>
        <td class="hidden px-3 py-2 sm:table-cell"></td>
      </tr>
    </tfoot>
  </table>
</Card>
