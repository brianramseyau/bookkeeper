<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import {
    listUtilities,
    getUtilityBills,
    getUtilityTrend,
    upsertUtilityBill,
    deleteUtilityBill,
    updateUtility,
    type Utility,
    type UtilityBill,
    type UtilityMonthlyShare,
    type UtilityTrend,
    type UtilityFrequency,
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
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete } from '@mdi/js'

  function focusOnMount(node: HTMLElement) {
    node.focus()
  }

  const utilityId = Number(page.params.utilityId)

  let utility = $state<Utility | null>(null)
  let bills = $state<UtilityBill[]>([])
  let monthlyShares = $state<UtilityMonthlyShare[]>([])
  let trend = $state<UtilityTrend | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

  let editingKey = $state<string | null>(null)
  // bind:value on a number input coerces to an actual number (NaN when empty),
  // not a string - see https://svelte.dev/docs/svelte/bind#Number-inputs
  let editingValue = $state<number>(NaN)
  // bind:value on a date input is always a plain string ("" when empty, else
  // "yyyy-MM-dd") - normalized to null on save, same as IncomeEntryEditRow.
  let editingReceivedOn = $state('')
  let saving = $state(false)

  let editingSettings = $state(false)
  let editFrequency = $state<UtilityFrequency>('monthly')
  let editDueOffsetDays = $state<number>(NaN)
  let editPaidInAdvance = $state(false)
  let savingSettings = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [utilities, billsResponse, trendResult] = await Promise.all([
        listUtilities(),
        getUtilityBills(utilityId),
        getUtilityTrend(utilityId),
      ])
      utility = utilities.find((u) => u.id === utilityId) ?? null
      bills = billsResponse.bills
      monthlyShares = billsResponse.monthlyShares
      trend = trendResult
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load utility'
    } finally {
      loading = false
    }
  }

  function billFor(year: number, month: number): UtilityBill | undefined {
    return bills.find((b) => b.year === year && b.month === month)
  }

  function shareFor(year: number, month: number): UtilityMonthlyShare | undefined {
    return monthlyShares.find((s) => s.year === year && s.month === month)
  }

  /**
   * A non-monthly bill entered off its expected cadence (e.g. two quarterly
   * Water bills a month apart instead of three) produces overlapping
   * periods - every month the periods share ends up with more than one
   * contributing bill. The cell only ever displays one of them (the bill
   * itself if present, else the first share), so this surfaces the others
   * as a warning instead of silently hiding the conflict.
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

  let selectedFinancialYear = $state(currentFinancialYear())

  const fyMonths = $derived(financialYearMonths(selectedFinancialYear))

  function changeFinancialYear(delta: number) {
    selectedFinancialYear += delta
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
      await upsertUtilityBill(utilityId, year, month, amount, undefined, receivedOn)
      // A single bill's amount also changes the computed shares of the
      // other months in its period, so refetch the whole set rather than
      // patching just this cell in place.
      const [billsResponse, trendResult] = await Promise.all([
        getUtilityBills(utilityId),
        getUtilityTrend(utilityId),
      ])
      bills = billsResponse.bills
      monthlyShares = billsResponse.monthlyShares
      trend = trendResult
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
      const [billsResponse, trendResult] = await Promise.all([
        getUtilityBills(utilityId),
        getUtilityTrend(utilityId),
      ])
      bills = billsResponse.bills
      monthlyShares = billsResponse.monthlyShares
      trend = trendResult
      // A no-op if this cell wasn't the one being edited - but if it was
      // (the in-edit Remove button), the bill it was editing is now gone,
      // so the input needs to close rather than keep showing a stale value.
      cancelEdit()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    } finally {
      saving = false
    }
  }

  function startEditSettings() {
    if (!utility) return
    editingSettings = true
    editFrequency = utility.frequency
    editDueOffsetDays = utility.dueOffsetDays ?? NaN
    editPaidInAdvance = utility.paidInAdvance
  }

  function cancelEditSettings() {
    editingSettings = false
  }

  async function saveSettings() {
    savingSettings = true
    error = null
    try {
      utility = await updateUtility(utilityId, {
        frequency: editFrequency,
        dueOffsetDays: Number.isNaN(editDueOffsetDays) ? null : editDueOffsetDays,
        paidInAdvance: editPaidInAdvance,
      })
      editingSettings = false
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save billing settings'
    } finally {
      savingSettings = false
    }
  }
</script>

<svelte:head>
  <title>{utility ? `${utility.name} · Bookkeeper` : 'Utilities · Bookkeeper'}</title>
</svelte:head>

<a
  href="/utilities"
  class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
>
  ← Utilities
</a>

{#if loading}
  <LoadingIndicator />
{:else if !utility}
  <ErrorMessage message="Utility not found." class="mt-6" />
{:else}
  <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">{utility.name}</h1>
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick={() => changeFinancialYear(-1)}
        class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        ← Prev
      </button>
      <span class="w-28 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {financialYearLabel(selectedFinancialYear)}
      </span>
      <button
        type="button"
        onclick={() => changeFinancialYear(1)}
        disabled={selectedFinancialYear >= currentFinancialYear()}
        class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Next →
      </button>
    </div>
  </div>

  {#if error}
    <ErrorMessage message={error} />
  {/if}

  {#if trend && trend.latestAmount !== null}
    <div class="mt-4 mb-6 flex gap-8">
      <div>
        <span class="block text-xs text-slate-400 dark:text-slate-500">Latest</span>
        <span class="block text-xl font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(trend.latestAmount)}
        </span>
      </div>
      <div>
        <span class="block text-xs text-slate-400 dark:text-slate-500">12-month average</span>
        <span class="block text-xl font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(trend.average)}
        </span>
      </div>
      <div>
        <span class="block text-xs text-slate-400 dark:text-slate-500">Trend</span>
        <span class="block text-xl font-semibold">
          <TrendIndicator trend={trend.trend ?? 'flat'} class="" />
        </span>
      </div>
    </div>
  {/if}

  <Card class="mb-6 p-4">
    {#if editingSettings}
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Frequency</span>
          <select
            bind:value={editFrequency}
            class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="biannual">Biannual</option>
            <option value="annual">Annual</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
            >Due (days after received)</span
          >
          <input
            type="number"
            min="0"
            placeholder="—"
            bind:value={editDueOffsetDays}
            class="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label class="flex items-center gap-2 pb-1.5">
          <input
            type="checkbox"
            bind:checked={editPaidInAdvance}
            class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
          />
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
            >Paid in advance / Pre-paid</span
          >
        </label>
        <IconActionButton
          variant="primary"
          disabled={savingSettings}
          label="Save {utility.name} settings"
          path={mdiContentSave}
          onclick={saveSettings}
        />
        <IconActionButton
          variant="cancel"
          label="Cancel editing {utility.name} settings"
          path={mdiCloseThick}
          onclick={cancelEditSettings}
        />
      </div>
    {:else}
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          <span class="font-medium text-slate-900 capitalize dark:text-slate-100"
            >{utility.frequency}</span
          >
          · {utility.paidInAdvance ? 'paid in advance' : 'paid in arrears'}
          {#if utility.dueOffsetDays !== null}
            · due {utility.dueOffsetDays} day{utility.dueOffsetDays === 1 ? '' : 's'} after received
          {:else}
            · no due-date offset set
          {/if}
        </p>
        <IconActionButton
          variant="neutral"
          label="Edit {utility.name} settings"
          path={mdiPencil}
          onclick={startEditSettings}
        />
      </div>
      {#if utility.frequency !== 'monthly'}
        <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Click the month it's actually billed in and enter the full bill - every month in that
          period then shows the same even monthly share, with the real total noted underneath. The
          other, non-billing months (in <span class="italic">italics</span>) are read-only.
          {#if utility.paidInAdvance}
            Paid in advance, so the billing month is the <span class="italic">first</span> month of the
            period.
          {:else}
            Paid in arrears, so the billing month is the <span class="italic">last</span> month of the
            period.
          {/if}
        </p>
      {/if}
    {/if}
  </Card>

  <Card class="overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Month</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Received</th
          >
        </tr>
      </thead>
      <tbody>
        {#each fyMonths as { year, month } (`${year}-${month}`)}
          {@const bill = billFor(year, month)}
          {@const share = shareFor(year, month)}
          {@const key = cellKey(year, month)}
          {@const displayAmount = share ? share.amount : bill?.amount}
          {@const showsBilledTotal = bill && share && share.amount !== bill.amount}
          {@const conflicts = conflictingBills(year, month)}
          <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
            <td
              class="px-3 py-1.5 font-medium whitespace-nowrap text-slate-700 dark:text-slate-300"
            >
              {monthYearLabel(year, month)}
            </td>
            <td class="px-1 py-1 text-right">
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
                  class="w-24 rounded-md border border-indigo-400 px-2 py-1 text-right text-sm focus:ring-indigo-500 dark:bg-slate-900 dark:text-slate-100"
                />
              {:else if !bill && share}
                <span
                  class="block w-full cursor-default rounded-md px-2 py-1.5 text-right text-slate-400 italic dark:text-slate-500"
                  title={`Part of the ${monthYearLabel(share.billYear, share.billMonth)} bill`}
                >
                  {formatCurrency(share.amount)}
                  {#if conflicts.length > 0}
                    <span
                      class="text-amber-500 dark:text-amber-400"
                      title={conflictTooltip(conflicts)}
                    >
                      ⚠
                    </span>
                  {/if}
                </span>
              {:else}
                <button
                  type="button"
                  onclick={() => startEdit(year, month)}
                  class={[
                    'w-full rounded-md px-2 py-1.5 text-right transition-colors hover:bg-slate-100 dark:hover:bg-slate-700',
                    bill
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-300 dark:text-slate-600',
                  ]}
                >
                  {bill ? formatCurrency(displayAmount!) : '+'}
                  {#if bill && conflicts.length > 0}
                    <span
                      class="text-amber-500 dark:text-amber-400"
                      title={conflictTooltip(conflicts)}
                    >
                      ⚠
                    </span>
                  {/if}
                  {#if showsBilledTotal}
                    <span class="block text-xs font-normal text-slate-400 dark:text-slate-500">
                      bills {formatCurrency(bill!.amount)}
                    </span>
                  {/if}
                </button>
              {/if}
            </td>
            <td class="px-1 py-1 text-left">
              {#if editingKey === key}
                <div class="flex items-center gap-1">
                  <input
                    type="date"
                    bind:value={editingReceivedOn}
                    disabled={saving}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') saveEdit(year, month)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    class="rounded-md border border-indigo-400 px-2 py-1 text-sm focus:ring-indigo-500 dark:bg-slate-900 dark:text-slate-100"
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
                  class="w-full rounded-md px-2 py-1.5 text-left text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  {formatDate(bill.receivedOn)}
                </button>
              {:else}
                <span class="block px-2 py-1.5 text-slate-300 dark:text-slate-600">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
{/if}
