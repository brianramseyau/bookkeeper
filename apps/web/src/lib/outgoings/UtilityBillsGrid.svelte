<script lang="ts">
  import { onMount } from 'svelte'
  import {
    getUtilityBills,
    upsertUtilityBill,
    deleteUtilityBill,
    type Utility,
    type UtilityBill,
    type UtilityMonthlyShare,
  } from '$lib/api/utilities'
  import {
    currentFinancialYear,
    financialYearLabel,
    financialYearMonths,
    formatCurrency,
    formatDate,
    monthYearLabel,
  } from '$lib/format'
  import { ApiError } from '$lib/api'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import { mdiPencil, mdiPlus, mdiDelete } from '@mdi/js'
  import UtilityBillFormSheet, { type UtilityBillFormValues } from './UtilityBillFormSheet.svelte'

  interface Props {
    utility: Utility
    /** Called after any bill change, so the detail's trend/stats refresh too. */
    onChanged: () => Promise<void>
  }

  let { utility, onChanged }: Props = $props()

  let bills = $state<UtilityBill[]>([])
  let monthlyShares = $state<UtilityMonthlyShare[]>([])
  let error = $state<string | null>(null)

  let selectedFinancialYear = $state(currentFinancialYear())

  let formOpen = $state(false)
  let formYear = $state<number | null>(null)
  let formMonth = $state<number | null>(null)
  let formSubmitting = $state(false)
  let formError = $state<string | null>(null)

  const fyMonths = $derived(financialYearMonths(selectedFinancialYear))
  const formBill = $derived(
    formYear !== null && formMonth !== null ? (billFor(formYear, formMonth) ?? null) : null
  )
  const formMonthLabel = $derived(
    formYear !== null && formMonth !== null ? monthYearLabel(formYear, formMonth) : ''
  )

  onMount(load)

  async function load() {
    error = null
    try {
      const response = await getUtilityBills(utility.id)
      bills = response.bills
      monthlyShares = response.monthlyShares
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load bills'
    }
  }

  async function reload() {
    const response = await getUtilityBills(utility.id)
    bills = response.bills
    monthlyShares = response.monthlyShares
  }

  function billFor(year: number, month: number): UtilityBill | undefined {
    return bills.find((b) => b.year === year && b.month === month)
  }

  function shareFor(year: number, month: number): UtilityMonthlyShare | undefined {
    return monthlyShares.find((s) => s.year === year && s.month === month)
  }

  /**
   * A non-monthly bill entered off its expected cadence (e.g. two quarterly
   * Water bills a month apart instead of three) produces overlapping periods
   * - every month the periods share ends up with more than one contributing
   * bill. The cell only ever displays one of them, so this surfaces the
   * others as a warning instead of silently hiding the conflict.
   */
  function conflictingBills(
    year: number,
    month: number
  ): { billYear: number; billMonth: number }[] {
    const bill = billFor(year, month)
    const shares = monthlyShares.filter((s) => s.year === year && s.month === month)
    const primaryKey = bill
      ? `${bill.year}-${bill.month}`
      : shares[0]
        ? `${shares[0].billYear}-${shares[0].billMonth}`
        : null

    const seen = new Set<string>()
    const conflicts: { billYear: number; billMonth: number }[] = []
    for (const share of shares) {
      const key = `${share.billYear}-${share.billMonth}`
      if (key === primaryKey || seen.has(key)) continue
      seen.add(key)
      conflicts.push({ billYear: share.billYear, billMonth: share.billMonth })
    }
    return conflicts
  }

  function conflictTooltip(conflicts: { billYear: number; billMonth: number }[]): string {
    const list = conflicts.map((c) => monthYearLabel(c.billYear, c.billMonth)).join(', ')
    return `Also covered by the ${list} bill${conflicts.length > 1 ? 's' : ''} - check for a duplicate or overlapping entry`
  }

  function openAdd(year: number, month: number) {
    formYear = year
    formMonth = month
    formError = null
    formOpen = true
  }

  function openEdit(year: number, month: number) {
    formYear = year
    formMonth = month
    formError = null
    formOpen = true
  }

  async function submitForm(values: UtilityBillFormValues) {
    if (formYear === null || formMonth === null) return
    formSubmitting = true
    formError = null
    try {
      await upsertUtilityBill(
        utility.id,
        formYear,
        formMonth,
        values.amount,
        undefined,
        values.receivedOn
      )
      formOpen = false
      await reload()
      await onChanged()
    } catch (err) {
      formError = err instanceof ApiError ? err.message : 'Failed to save'
    } finally {
      formSubmitting = false
    }
  }

  async function removeBill(bill: UtilityBill, monthLabel: string) {
    const confirmed = await confirmDestructive({
      title: `Delete the ${monthLabel} bill?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    error = null
    try {
      await deleteUtilityBill(bill.id)
      await reload()
      await onChanged()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  function menuActionsFor(year: number, month: number) {
    const bill = billFor(year, month)
    const monthLabel = monthYearLabel(year, month)
    if (!bill) {
      return [
        {
          label: 'Add bill',
          path: mdiPlus,
          variant: 'neutral' as const,
          onclick: () => openAdd(year, month),
        },
      ]
    }
    return [
      {
        label: 'Edit',
        path: mdiPencil,
        variant: 'neutral' as const,
        onclick: () => openEdit(year, month),
      },
      {
        label: 'Delete',
        path: mdiDelete,
        variant: 'danger' as const,
        onclick: () => removeBill(bill, monthLabel),
      },
    ]
  }
</script>

{#if error}
  <div class="mt-4"><ErrorMessage message={error} /></div>
{/if}

<div class="mt-8">
  <div class="mb-3 flex items-center justify-between gap-3">
    <h2 class="text-foreground text-lg font-semibold">Bills by financial year</h2>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => (selectedFinancialYear -= 1)}
        class="border-border text-muted-foreground hover:bg-accent rounded-md border px-2 py-1 text-sm"
      >
        ← Prev
      </button>
      <span class="text-foreground w-28 text-center text-sm font-medium">
        {financialYearLabel(selectedFinancialYear)}
      </span>
      <button
        type="button"
        onclick={() => (selectedFinancialYear += 1)}
        disabled={selectedFinancialYear >= currentFinancialYear()}
        class="border-border text-muted-foreground hover:bg-accent rounded-md border px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  </div>

  {#if utility.frequency !== 'monthly'}
    <p class="text-muted-foreground mb-3 text-xs">
      Use the menu next to the month it's actually billed in to enter the full bill - every month in
      that period then shows the same even monthly share, with the real total noted underneath. The
      other, non-billing months (in <span class="italic">italics</span>) are read-only.
      {#if utility.paidInAdvance}
        Paid in advance, so the billing month is the <span class="italic">first</span> month of the period.
      {:else}
        Paid in arrears, so the billing month is the <span class="italic">last</span> month of the period.
      {/if}
    </p>
  {/if}

  <Card class="sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-border border-b">
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Month</th>
          <th class="text-muted-foreground px-3 py-2 text-right font-medium">Amount</th>
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Received</th>
          <th class="w-12"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each fyMonths as { year, month } (`${year}-${month}`)}
          {@const bill = billFor(year, month)}
          {@const share = shareFor(year, month)}
          {@const displayAmount = share ? share.amount : bill?.amount}
          {@const showsBilledTotal = bill && share && share.amount !== bill.amount}
          {@const conflicts = conflictingBills(year, month)}
          {@const readOnly = !bill && Boolean(share)}
          <tr
            class="divide-border border-border bg-card sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:last:border-0"
          >
            <td class="text-foreground px-3 py-1.5 font-medium whitespace-nowrap sm:table-cell">
              {monthYearLabel(year, month)}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-1.5 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
              {#if readOnly}
                <span
                  class="text-muted-foreground italic"
                  title={`Part of the ${monthYearLabel(share!.billYear, share!.billMonth)} bill`}
                >
                  {formatCurrency(share!.amount)}
                  {#if conflicts.length > 0}
                    <span class="text-due" title={conflictTooltip(conflicts)}>⚠</span>
                  {/if}
                </span>
              {:else if bill}
                <span class="text-foreground">
                  {formatCurrency(displayAmount!)}
                  {#if conflicts.length > 0}
                    <span class="text-due" title={conflictTooltip(conflicts)}>⚠</span>
                  {/if}
                  {#if showsBilledTotal}
                    <span class="text-muted-foreground block text-xs font-normal">
                      bills {formatCurrency(bill.amount)}
                    </span>
                  {/if}
                </span>
              {:else}
                <span class="text-muted-foreground">—</span>
              {/if}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-1.5 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Received</span>
              <span class="text-muted-foreground">
                {bill?.receivedOn ? formatDate(bill.receivedOn) : '—'}
              </span>
            </td>
            <td class="px-3 py-1.5 text-right whitespace-nowrap sm:table-cell">
              {#if !readOnly}
                <ActionMenu
                  label="Actions for the {monthYearLabel(year, month)} bill"
                  actions={menuActionsFor(year, month)}
                />
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
</div>

<UtilityBillFormSheet
  open={formOpen}
  onOpenChange={(open) => {
    formOpen = open
    if (!open) {
      formYear = null
      formMonth = null
    }
  }}
  monthLabel={formMonthLabel}
  bill={formBill}
  submitting={formSubmitting}
  error={formError}
  onSubmit={submitForm}
/>
