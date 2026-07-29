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
    monthYearLabel,
  } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import TextActionButton from '$lib/components/TextActionButton.svelte'
  import TrendIndicator from '$lib/components/TrendIndicator.svelte'

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
  }

  function cancelEdit() {
    editingKey = null
    editingValue = NaN
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
      await upsertUtilityBill(utilityId, year, month, amount)
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
            >Due (day of the billing month)</span
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
        <PrimaryButton size="sm" disabled={savingSettings} onclick={saveSettings}
          >Save</PrimaryButton
        >
        <button
          type="button"
          onclick={cancelEditSettings}
          class="text-sm text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
    {:else}
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          <span class="font-medium text-slate-900 capitalize dark:text-slate-100"
            >{utility.frequency}</span
          >
          · {utility.paidInAdvance ? 'paid in advance' : 'paid in arrears'}
          {#if utility.dueOffsetDays !== null}
            · due on day {utility.dueOffsetDays} of the billing month
          {:else}
            · no due-date offset set
          {/if}
        </p>
        <TextActionButton variant="neutral" onclick={startEditSettings}>Edit</TextActionButton>
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
        </tr>
      </thead>
      <tbody>
        {#each fyMonths as { year, month } (`${year}-${month}`)}
          {@const bill = billFor(year, month)}
          {@const share = shareFor(year, month)}
          {@const key = cellKey(year, month)}
          {@const displayAmount = share ? share.amount : bill?.amount}
          {@const showsBilledTotal = bill && share && share.amount !== bill.amount}
          <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
            <td
              class="px-3 py-1.5 font-medium whitespace-nowrap text-slate-700 dark:text-slate-300"
            >
              {monthYearLabel(year, month)}
            </td>
            <td class="group relative px-1 py-1 text-right">
              {#if editingKey === key}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editingValue}
                  disabled={saving}
                  onblur={() => saveEdit(year, month)}
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
                  {#if showsBilledTotal}
                    <span class="block text-xs font-normal text-slate-400 dark:text-slate-500">
                      bills {formatCurrency(bill!.amount)}
                    </span>
                  {/if}
                </button>
                {#if bill}
                  <button
                    type="button"
                    aria-label="Remove"
                    onclick={() => removeCell(year, month)}
                    class="absolute top-0.5 right-0.5 rounded px-1 text-xs text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 focus:opacity-100 dark:text-slate-600 dark:hover:text-red-400 pointer-coarse:opacity-100"
                  >
                    ×
                  </button>
                {/if}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
{/if}
