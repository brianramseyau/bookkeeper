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
    type UtilityTrend,
    type UtilityFrequency,
  } from '$lib/api/utilities'
  import { formatCurrency, monthShortName } from '$lib/format'
  import { ApiError } from '$lib/api'

  function focusOnMount(node: HTMLElement) {
    node.focus()
  }

  const utilityId = Number(page.params.utilityId)

  let utility = $state<Utility | null>(null)
  let bills = $state<UtilityBill[]>([])
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
  let savingSettings = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [utilities, billList, trendResult] = await Promise.all([
        listUtilities(),
        getUtilityBills(utilityId),
        getUtilityTrend(utilityId),
      ])
      utility = utilities.find((u) => u.id === utilityId) ?? null
      bills = billList
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

  let years = $state<number[]>([])

  $effect(() => {
    const currentYear = new Date().getFullYear()
    const fromBills = bills.map((b) => b.year)
    const all = new Set([...fromBills, currentYear])
    years = [...all].sort((a, b) => a - b)
  })

  function addNextYear() {
    const next = (years[years.length - 1] ?? new Date().getFullYear()) + 1
    years = [...years, next]
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
      const bill = await upsertUtilityBill(utilityId, year, month, amount)
      bills = [...bills.filter((b) => !(b.year === year && b.month === month)), bill]
      trend = await getUtilityTrend(utilityId)
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
      bills = bills.filter((b) => b.id !== bill.id)
      trend = await getUtilityTrend(utilityId)
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
      })
      editingSettings = false
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save billing settings'
    } finally {
      savingSettings = false
    }
  }
</script>

<a
  href="/utilities"
  class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
>
  ← Utilities
</a>

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else if !utility}
  <p class="mt-6 text-sm text-red-600 dark:text-red-400">Utility not found.</p>
{:else}
  <h1 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{utility.name}</h1>

  {#if error}
    <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
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
          {#if trend.trend === 'up'}
            <span class="text-red-600 dark:text-red-400">▲ up</span>
          {:else if trend.trend === 'down'}
            <span class="text-emerald-600 dark:text-emerald-400">▼ down</span>
          {:else}
            <span class="text-slate-400 dark:text-slate-500">— flat</span>
          {/if}
        </span>
      </div>
    </div>
  {/if}

  <div
    class="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
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
            >Due (days after billing period ends)</span
          >
          <input
            type="number"
            min="0"
            placeholder="—"
            bind:value={editDueOffsetDays}
            class="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <button
          type="button"
          onclick={saveSettings}
          disabled={savingSettings}
          class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          Save
        </button>
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
          <span class="font-medium text-slate-900 dark:text-slate-100 capitalize"
            >{utility.frequency}</span
          >
          {#if utility.dueOffsetDays !== null}
            · due {utility.dueOffsetDays} day{utility.dueOffsetDays === 1 ? '' : 's'} after billing
            period ends
          {:else}
            · no due-date offset set
          {/if}
        </p>
        <button
          type="button"
          onclick={startEditSettings}
          class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
        >
          Edit
        </button>
      </div>
    {/if}
  </div>

  <div
    class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Month</th
          >
          {#each years as year (year)}
            <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
              >{year}</th
            >
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each Array(12) as _, i (i)}
          {@const month = i + 1}
          <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
            <td
              class="px-3 py-1.5 font-medium whitespace-nowrap text-slate-700 dark:text-slate-300"
            >
              {monthShortName(month)}
            </td>
            {#each years as year (year)}
              {@const bill = billFor(year, month)}
              {@const key = cellKey(year, month)}
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
                    {bill ? formatCurrency(bill.amount) : '+'}
                  </button>
                  {#if bill}
                    <button
                      type="button"
                      aria-label="Remove"
                      onclick={() => removeCell(year, month)}
                      class="absolute top-0.5 right-0.5 rounded px-1 text-xs text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                    >
                      ×
                    </button>
                  {/if}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <button
    type="button"
    onclick={addNextYear}
    class="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
  >
    + Add {years[years.length - 1] + 1}
  </button>
{/if}
