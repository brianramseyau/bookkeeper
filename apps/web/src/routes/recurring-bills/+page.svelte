<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listUpcomingRecurringBills,
    createRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    type UpcomingRecurringBill,
    type RecurringBillFrequency,
    type RecurringBillCustomIntervalUnit,
  } from '$lib/api/recurring-bills'
  import { listCategories, type Category } from '$lib/api/categories'
  import { formatCurrency, formatDate, formatDaysUntilDue } from '$lib/format'
  import { ApiError } from '$lib/api'

  const FREQUENCIES: { value: RecurringBillFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'biannual', label: 'Biannual' },
    { value: 'annual', label: 'Annual' },
    { value: 'custom', label: 'Custom' },
  ]

  let bills = $state<UpcomingRecurringBill[]>([])
  let categories = $state<Category[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  let name = $state('')
  let amount = $state<number>(NaN)
  let frequency = $state<RecurringBillFrequency>('annual')
  let customIntervalValue = $state<number>(NaN)
  let customIntervalUnit = $state<RecurringBillCustomIntervalUnit>('weeks')
  let nextDueOn = $state('')
  let categoryId = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editAmount = $state<number>(NaN)
  let editFrequency = $state<RecurringBillFrequency>('annual')
  let editCustomIntervalValue = $state<number>(NaN)
  let editCustomIntervalUnit = $state<RecurringBillCustomIntervalUnit>('weeks')
  let editNextDueOn = $state('')
  let savingEdit = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [billList, categoryList] = await Promise.all([
        listUpcomingRecurringBills(),
        listCategories(),
      ])
      bills = billList
      categories = categoryList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load recurring bills'
    } finally {
      loading = false
    }
  }

  function frequencyLabel(bill: UpcomingRecurringBill): string {
    if (bill.frequency === 'custom') {
      const value = bill.customIntervalValue
      const unit = bill.customIntervalUnit
      return value && unit ? `Every ${value} ${unit}` : 'Custom'
    }
    return FREQUENCIES.find((f) => f.value === bill.frequency)?.label ?? bill.frequency
  }

  async function handleCategoryChange(bill: UpcomingRecurringBill, value: string) {
    error = null
    try {
      await updateRecurringBill(bill.id, {
        categoryId: value === '' ? null : Number(value),
      })
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update category'
    }
  }

  async function handleDelete(bill: UpcomingRecurringBill) {
    error = null
    try {
      await deleteRecurringBill(bill.id)
      bills = bills.filter((b) => b.id !== bill.id)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!name.trim() || !nextDueOn || Number.isNaN(amount)) {
      error = 'Name, amount, and next due date are required'
      return
    }
    creating = true
    error = null
    try {
      await createRecurringBill({
        name: name.trim(),
        amount,
        frequency,
        customIntervalValue:
          frequency === 'custom' && !Number.isNaN(customIntervalValue)
            ? customIntervalValue
            : undefined,
        customIntervalUnit: frequency === 'custom' ? customIntervalUnit : undefined,
        nextDueOn,
        categoryId: categoryId === '' ? undefined : Number(categoryId),
      })
      name = ''
      amount = NaN
      frequency = 'annual'
      customIntervalValue = NaN
      nextDueOn = ''
      categoryId = ''
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add recurring bill'
    } finally {
      creating = false
    }
  }

  function startEdit(bill: UpcomingRecurringBill) {
    editingId = bill.id
    editName = bill.name
    editAmount = bill.amount
    editFrequency = bill.frequency
    editCustomIntervalValue = bill.customIntervalValue ?? NaN
    editCustomIntervalUnit = bill.customIntervalUnit ?? 'weeks'
    editNextDueOn = bill.nextDueOn ? bill.nextDueOn.slice(0, 10) : ''
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(bill: UpcomingRecurringBill) {
    if (!editName.trim() || !editNextDueOn || Number.isNaN(editAmount)) {
      error = 'Name, amount, and next due date are required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateRecurringBill(bill.id, {
        name: editName.trim(),
        amount: editAmount,
        frequency: editFrequency,
        customIntervalValue:
          editFrequency === 'custom' && !Number.isNaN(editCustomIntervalValue)
            ? editCustomIntervalValue
            : undefined,
        customIntervalUnit: editFrequency === 'custom' ? editCustomIntervalUnit : undefined,
        nextDueOn: editNextDueOn,
      })
      editingId = null
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }
</script>

<svelte:head>
  <title>Recurring Bills · Bookkeeper</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Recurring Bills</h1>

{#if error}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else}
  <div
    class="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Name</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Category</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Frequency</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Next due</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"></th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each bills as bill (bill.id)}
          {#if editingId === bill.id}
            <tr
              class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
            >
              <td class="px-3 py-2">
                <input
                  type="text"
                  bind:value={editName}
                  class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2">
                <select
                  value={bill.categoryId ?? ''}
                  onchange={(e) => handleCategoryChange(bill, e.currentTarget.value)}
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">Uncategorized</option>
                  {#each categories as category (category.id)}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                </select>
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editAmount}
                  class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2">
                <div class="flex flex-col gap-1">
                  <select
                    bind:value={editFrequency}
                    class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {#each FREQUENCIES as f (f.value)}
                      <option value={f.value}>{f.label}</option>
                    {/each}
                  </select>
                  {#if editFrequency === 'custom'}
                    <div class="flex gap-1">
                      <input
                        type="number"
                        min="1"
                        bind:value={editCustomIntervalValue}
                        class="w-14 rounded-md border border-slate-300 px-1 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <select
                        bind:value={editCustomIntervalUnit}
                        class="rounded-md border border-slate-300 px-1 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                  {/if}
                </div>
              </td>
              <td class="px-3 py-2">
                <input
                  type="date"
                  bind:value={editNextDueOn}
                  class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2"></td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => saveEdit(bill)}
                  disabled={savingEdit}
                  class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Save
                </button>
                <button
                  type="button"
                  onclick={cancelEdit}
                  class="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </td>
            </tr>
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{bill.name}</td>
              <td class="px-3 py-2">
                <select
                  value={bill.categoryId ?? ''}
                  onchange={(e) => handleCategoryChange(bill, e.currentTarget.value)}
                  class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="">Uncategorized</option>
                  {#each categories as category (category.id)}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                </select>
              </td>
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(bill.amount)}
              </td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400">{frequencyLabel(bill)}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                {formatDate(bill.nextDueOn)}
              </td>
              <td class="px-3 py-2">
                {#if bill.dueSoon}
                  <span
                    class={[
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      bill.daysUntilDue !== null && bill.daysUntilDue < 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                    ]}
                  >
                    {formatDaysUntilDue(bill.daysUntilDue)}
                  </span>
                {/if}
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => startEdit(bill)}
                  class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onclick={() => handleDelete(bill)}
                  class="ml-2 text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <form
    onsubmit={handleAdd}
    class="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Name</span>
      <input
        type="text"
        bind:value={name}
        placeholder="e.g. Netflix"
        class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Category</span>
      <select
        bind:value={categoryId}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">Uncategorized</option>
        {#each categories as category (category.id)}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={amount}
        class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Frequency</span>
      <select
        bind:value={frequency}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        {#each FREQUENCIES as f (f.value)}
          <option value={f.value}>{f.label}</option>
        {/each}
      </select>
    </label>
    {#if frequency === 'custom'}
      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Every</span>
        <input
          type="number"
          min="1"
          bind:value={customIntervalValue}
          class="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Unit</span>
        <select
          bind:value={customIntervalUnit}
          class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
          <option value="months">Months</option>
        </select>
      </label>
    {/if}
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Next due</span>
      <input
        type="date"
        bind:value={nextDueOn}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <button
      type="submit"
      disabled={creating}
      class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {creating ? 'Adding…' : 'Add bill'}
    </button>
  </form>
{/if}
