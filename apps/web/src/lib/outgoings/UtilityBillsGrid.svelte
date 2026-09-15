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
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiCloseThick, mdiContentSave, mdiDelete } from '@mdi/js'

  interface Props {
    utility: Utility
    /** Called after any bill change, so the detail's trend/stats refresh too. */
    onChanged: () => Promise<void>
  }

  let { utility, onChanged }: Props = $props()

  let bills = $state<UtilityBill[]>([])
  let monthlyShares = $state<UtilityMonthlyShare[]>([])
  let error = $state<string | null>(null)

  let editingKey = $state<string | null>(null)
  let editingValue = $state<number>(NaN)
  let editingReceivedOn = $state('')
  let saving = $state(false)

  let selectedFinancialYear = $state(currentFinancialYear())

  const fyMonths = $derived(financialYearMonths(selectedFinancialYear))

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

  function focusOnMount(node: HTMLElement) {
    node.focus()
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

  function cellKey(year: number, month: number) {
    return `${year}-${month}`
  }

  function startEdit(year: number, month: number) {
    const bill = billFor(year, month)
    editingKey = cellKey(year, month)
    editingValue = bill ? bill.amount : NaN
    editingReceivedOn = bill?.receivedOn ? bill.receivedOn.slice(0, 10) : ''
  }

  function cancelEdit() {
    editingKey = null
    editingValue = NaN
    editingReceivedOn = ''
  }

  async function saveEdit(year: number, month: number) {
    if (Number.isNaN(editingValue)) {
      cancelEdit()
      return
    }
    const amount = editingValue
    if (!Number.isFinite(amount) || amount < 0) {
      error = 'Enter a valid amount'
      return
    }

    saving = true
    error = null
    try {
      const receivedOn = editingReceivedOn === '' ? null : editingReceivedOn
      await upsertUtilityBill(utility.id, year, month, amount, undefined, receivedOn)
      await reload()
      await onChanged()
      cancelEdit()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save'
    } finally {
      saving = false
    }
  }

  async function removeCell(year: number, month: number) {
    const bill = billFor(year, month)
    if (!bill) return
    saving = true
    error = null
    try {
      await deleteUtilityBill(bill.id)
      await reload()
      await onChanged()
      cancelEdit()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    } finally {
      saving = false
    }
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
      Click the month it's actually billed in and enter the full bill - every month in that period
      then shows the same even monthly share, with the real total noted underneath. The other,
      non-billing months (in <span class="italic">italics</span>) are read-only.
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
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each fyMonths as { year, month } (`${year}-${month}`)}
          {@const bill = billFor(year, month)}
          {@const share = shareFor(year, month)}
          {@const key = cellKey(year, month)}
          {@const displayAmount = share ? share.amount : bill?.amount}
          {@const showsBilledTotal = bill && share && share.amount !== bill.amount}
          {@const conflicts = conflictingBills(year, month)}
          <tr
            class="divide-border border-border bg-card sm:border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
          >
            <td class="text-foreground px-3 py-1.5 font-medium whitespace-nowrap sm:table-cell">
              {monthYearLabel(year, month)}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-1 py-1 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Amount</span>
              {#if editingKey === key}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editingValue}
                  disabled={saving}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') saveEdit(year, month)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  use:focusOnMount
                  class="border-primary w-full rounded-md border px-2 py-1 text-right text-sm sm:w-24"
                />
              {:else if !bill && share}
                <span
                  class="text-muted-foreground block w-full cursor-default rounded-md px-2 py-1.5 text-right italic"
                  title={`Part of the ${monthYearLabel(share.billYear, share.billMonth)} bill`}
                >
                  {formatCurrency(share.amount)}
                  {#if conflicts.length > 0}
                    <span class="text-due" title={conflictTooltip(conflicts)}>⚠</span>
                  {/if}
                </span>
              {:else}
                <button
                  type="button"
                  onclick={() => startEdit(year, month)}
                  class={[
                    'hover:bg-accent w-full rounded-md px-2 py-1.5 text-right transition-colors',
                    bill ? 'text-foreground' : 'text-muted-foreground',
                  ]}
                >
                  {bill ? formatCurrency(displayAmount!) : '+'}
                  {#if bill && conflicts.length > 0}
                    <span class="text-due" title={conflictTooltip(conflicts)}>⚠</span>
                  {/if}
                  {#if showsBilledTotal}
                    <span class="text-muted-foreground block text-xs font-normal">
                      bills {formatCurrency(bill!.amount)}
                    </span>
                  {/if}
                </button>
              {/if}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-1 py-1 sm:table-cell sm:text-right"
            >
              <span class="text-muted-foreground shrink-0 text-xs sm:hidden">Received</span>
              {#if editingKey === key}
                <div class="flex items-center gap-1 sm:justify-end">
                  <input
                    type="date"
                    bind:value={editingReceivedOn}
                    disabled={saving}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') saveEdit(year, month)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    class="border-primary rounded-md border px-2 py-1 text-sm"
                  />
                  <IconActionButton
                    variant="primary"
                    disabled={saving}
                    label="Save {monthYearLabel(year, month)} bill"
                    path={mdiContentSave}
                    onclick={() => saveEdit(year, month)}
                  />
                  <IconActionButton
                    variant="cancel"
                    disabled={saving}
                    label="Cancel editing {monthYearLabel(year, month)} bill"
                    path={mdiCloseThick}
                    onclick={cancelEdit}
                  />
                  {#if bill}
                    <IconActionButton
                      variant="danger"
                      disabled={saving}
                      label="Delete {monthYearLabel(year, month)} bill"
                      path={mdiDelete}
                      onclick={() => removeCell(year, month)}
                    />
                  {/if}
                </div>
              {:else if bill}
                <button
                  type="button"
                  onclick={() => startEdit(year, month)}
                  class="text-muted-foreground hover:bg-accent w-full rounded-md px-2 py-1.5 text-right transition-colors"
                >
                  {formatDate(bill.receivedOn)}
                </button>
              {:else}
                <span class="text-muted-foreground block px-2 py-1.5 text-right">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
</div>
