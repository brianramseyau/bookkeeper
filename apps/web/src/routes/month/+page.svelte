<script lang="ts">
  import { onMount } from 'svelte'
  import { getStandardMonth, type StandardMonthResult, type StandardMonthLine } from '$lib/api/standard-month'
  import { setMonthCarryover } from '$lib/api/month-carryover'
  import {
    listIncomeSources,
    createIncomeSource,
    updateIncomeSource,
    listIncomeEntries,
    createIncomeEntry,
    deleteIncomeEntry,
    type IncomeSource,
    type IncomeEntry,
  } from '$lib/api/income'
  import { upsertUtilityBill } from '$lib/api/utilities'
  import {
    listCategoryActuals,
    createCategoryActual,
    updateCategoryActual,
    deleteCategoryActual,
  } from '$lib/api/category-actuals'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { formatCurrency, formatDate, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  let year = $state(currentYear)
  let month = $state(currentMonth)
  let data = $state<StandardMonthResult | null>(null)
  let sources = $state<IncomeSource[]>([])
  let entries = $state<IncomeEntry[]>([])
  let users = $state<UserSummary[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  let editingSourceId = $state<number | null>(null)
  let editExpectedAmount = $state<number>(NaN)
  let savingSource = $state(false)

  let editingCarryover = $state(false)
  let editCarryoverAmount = $state<number>(NaN)
  let savingCarryover = $state(false)

  let newSourceUserId = $state('')
  let newSourceName = $state('')
  let newSourceAmount = $state<number>(NaN)
  let creatingSource = $state(false)

  let logSourceId = $state('')
  let logAmount = $state<number>(NaN)
  let logReceivedOn = $state('')
  let logNote = $state('')
  let loggingEntry = $state(false)

  type ExpenseEditMode = 'utility' | 'category-add' | 'category-edit' | 'category-multiple'
  let editingExpenseKey = $state<string | null>(null)
  let editExpenseMode = $state<ExpenseEditMode | null>(null)
  let editExpenseTargetId = $state<number | null>(null)
  let editExpenseCategoryId = $state<number | null>(null)
  let editExpenseAmount = $state<number>(NaN)
  let savingExpense = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [monthResult, sourceList, entryList, userList] = await Promise.all([
        getStandardMonth(year, month),
        listIncomeSources(),
        listIncomeEntries(year, month),
        listUsers(),
      ])
      data = monthResult
      sources = sourceList
      entries = entryList
      users = userList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load standard month'
    } finally {
      loading = false
    }
  }

  const isCurrentMonth = $derived(year === currentYear && month === currentMonth)

  function changeMonth(delta: number) {
    let newMonth = month + delta
    let newYear = year
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    } else if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    month = newMonth
    year = newYear
    void load()
  }

  function goToCurrentMonth() {
    year = currentYear
    month = currentMonth
    void load()
  }

  function startEditSource(source: IncomeSource) {
    editingSourceId = source.id
    editExpectedAmount = source.expectedAmount
  }

  function cancelEditSource() {
    editingSourceId = null
  }

  async function saveSource(source: IncomeSource) {
    if (Number.isNaN(editExpectedAmount)) return
    savingSource = true
    error = null
    try {
      await updateIncomeSource(source.id, { expectedAmount: editExpectedAmount })
      editingSourceId = null
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save income source'
    } finally {
      savingSource = false
    }
  }

  function startEditCarryover() {
    editingCarryover = true
    editCarryoverAmount = data?.carryover ?? NaN
  }

  function cancelEditCarryover() {
    editingCarryover = false
  }

  async function saveCarryover() {
    if (Number.isNaN(editCarryoverAmount)) return
    savingCarryover = true
    error = null
    try {
      await setMonthCarryover(year, month, editCarryoverAmount)
      editingCarryover = false
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save carried-over balance'
    } finally {
      savingCarryover = false
    }
  }

  async function handleAddSource(event: SubmitEvent) {
    event.preventDefault()
    if (!newSourceUserId || !newSourceName.trim() || Number.isNaN(newSourceAmount)) {
      error = 'User, name, and expected amount are required'
      return
    }
    creatingSource = true
    error = null
    try {
      await createIncomeSource({
        userId: Number(newSourceUserId),
        name: newSourceName.trim(),
        expectedAmount: newSourceAmount,
      })
      newSourceUserId = ''
      newSourceName = ''
      newSourceAmount = NaN
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add income source'
    } finally {
      creatingSource = false
    }
  }

  async function handleLogEntry(event: SubmitEvent) {
    event.preventDefault()
    if (Number.isNaN(logAmount)) {
      error = 'Amount is required'
      return
    }
    loggingEntry = true
    error = null
    try {
      await createIncomeEntry({
        incomeSourceId: logSourceId === '' ? null : Number(logSourceId),
        year,
        month,
        amount: logAmount,
        receivedOn: logReceivedOn === '' ? null : logReceivedOn,
        note: logNote.trim() === '' ? null : logNote.trim(),
      })
      logSourceId = ''
      logAmount = NaN
      logReceivedOn = ''
      logNote = ''
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to log income'
    } finally {
      loggingEntry = false
    }
  }

  async function handleDeleteEntry(entry: IncomeEntry) {
    error = null
    try {
      await deleteIncomeEntry(entry.id)
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete entry'
    }
  }

  function sourceName(sourceId: number | null): string {
    if (sourceId === null) return 'Unattributed'
    return sources.find((s) => s.id === sourceId)?.name ?? `Source #${sourceId}`
  }

  function lastDayOfMonthIso(y: number, m: number): string {
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  }

  function dueLabel(line: StandardMonthLine): string {
    if (line.dueDate) return formatDate(line.dueDate)
    if (line.dueDay) return `Day ${line.dueDay}`
    return '—'
  }

  function cancelEditExpense() {
    editingExpenseKey = null
    editExpenseMode = null
    editExpenseTargetId = null
    editExpenseCategoryId = null
  }

  async function startEditExpense(line: StandardMonthLine) {
    error = null
    if (line.key.startsWith('utility-')) {
      editingExpenseKey = line.key
      editExpenseMode = 'utility'
      editExpenseTargetId = Number(line.key.slice('utility-'.length))
      editExpenseCategoryId = null
      editExpenseAmount = line.actual ?? NaN
      return
    }
    if (line.key.startsWith('category-')) {
      const categoryId = Number(line.key.slice('category-'.length))
      try {
        const actuals = await listCategoryActuals(categoryId, year, month)
        editingExpenseKey = line.key
        editExpenseCategoryId = categoryId
        if (actuals.length === 0) {
          editExpenseMode = 'category-add'
          editExpenseTargetId = categoryId
          editExpenseAmount = NaN
        } else if (actuals.length === 1) {
          editExpenseMode = 'category-edit'
          editExpenseTargetId = actuals[0]!.id
          editExpenseAmount = actuals[0]!.amount
        } else {
          editExpenseMode = 'category-multiple'
          editExpenseTargetId = categoryId
        }
      } catch (err) {
        error = err instanceof ApiError ? err.message : 'Failed to load actuals'
      }
    }
  }

  async function saveExpenseEdit() {
    if (editExpenseMode === 'category-multiple' || editExpenseTargetId === null) return
    if (Number.isNaN(editExpenseAmount)) return

    savingExpense = true
    error = null
    try {
      if (editExpenseMode === 'utility') {
        await upsertUtilityBill(editExpenseTargetId, year, month, editExpenseAmount)
      } else if (editExpenseMode === 'category-add') {
        await createCategoryActual(editExpenseTargetId, {
          occurredOn: lastDayOfMonthIso(year, month),
          amount: editExpenseAmount,
        })
      } else if (editExpenseMode === 'category-edit') {
        await updateCategoryActual(editExpenseTargetId, { amount: editExpenseAmount })
      }
      cancelEditExpense()
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save actual'
    } finally {
      savingExpense = false
    }
  }

  async function removeExpenseActual() {
    if (editExpenseMode !== 'category-edit' || editExpenseTargetId === null) return
    error = null
    try {
      await deleteCategoryActual(editExpenseTargetId)
      cancelEditExpense()
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to remove actual'
    }
  }
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Standard Month</h1>
  <div class="flex items-center gap-3">
    <button
      type="button"
      onclick={goToCurrentMonth}
      disabled={isCurrentMonth}
      aria-hidden={isCurrentMonth}
      tabindex={isCurrentMonth ? -1 : 0}
      class={[
        'rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50',
        isCurrentMonth && 'invisible',
      ]}
    >
      This Month
    </button>
    <button
      type="button"
      onclick={() => changeMonth(-1)}
      class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      ← Prev
    </button>
    <span class="w-36 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
      {monthName(month)} {year}
    </span>
    <button
      type="button"
      onclick={() => changeMonth(1)}
      class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Next →
    </button>
  </div>
</div>

{#if error}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
{:else if data}
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">
        Carried over from last month
      </p>
      {#if editingCarryover}
        <div class="mt-1 flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            bind:value={editCarryoverAmount}
            class="w-28 rounded-md border border-slate-300 px-2 py-1 text-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onclick={saveCarryover}
            disabled={savingCarryover}
            class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Save
          </button>
          <button
            type="button"
            onclick={cancelEditCarryover}
            class="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      {:else}
        <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(data.carryover)}
        </p>
        <button
          type="button"
          onclick={startEditCarryover}
          class="mt-1 text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
        >
          Edit
        </button>
      {/if}
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Projected net</p>
      <p
        class={[
          'mt-1 text-2xl font-semibold',
          data.projectedNet >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400',
        ]}
      >
        {formatCurrency(data.projectedNet)}
      </p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Actual net (so far)</p>
      <p
        class={[
          'mt-1 text-2xl font-semibold',
          data.actualNet >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400',
        ]}
      >
        {formatCurrency(data.actualNet)}
      </p>
    </div>
  </div>

  <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Income</h2>
  <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Source</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Owner</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Projected</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Actual</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.income.lines as line (line.key)}
          {@const source = sources.find((s) => line.key === `income-source-${s.id}`)}
          {#if source && editingSourceId === source.id}
            <tr class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{line.label}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                {users.find((u) => u.id === source.userId)?.fullName ?? '—'}
              </td>
              <td class="px-3 py-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={editExpectedAmount}
                  class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </td>
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
                >{formatCurrency(line.actual)}</td
              >
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button
                  type="button"
                  onclick={() => saveSource(source)}
                  disabled={savingSource}
                  class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Save
                </button>
                <button
                  type="button"
                  onclick={cancelEditSource}
                  class="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </td>
            </tr>
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{line.label}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                {source ? (users.find((u) => u.id === source.userId)?.fullName ?? '—') : '—'}
              </td>
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
                >{formatCurrency(line.projected)}</td
              >
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
                >{formatCurrency(line.actual)}</td
              >
              <td class="px-3 py-2 text-right whitespace-nowrap">
                {#if source}
                  <button
                    type="button"
                    onclick={() => startEditSource(source)}
                    class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                  >
                    Edit
                  </button>
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t border-slate-200 font-semibold dark:border-slate-700">
          <td class="px-3 py-2 text-slate-900 dark:text-slate-100" colspan="2">Total</td>
          <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
            >{formatCurrency(data.income.projectedTotal)}</td
          >
          <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
            >{formatCurrency(data.income.actualTotal)}</td
          >
          <td class="px-3 py-2"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <form
    onsubmit={handleAddSource}
    class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Owner</span>
      <select
        bind:value={newSourceUserId}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">Select…</option>
        {#each users as user (user.id)}
          <option value={user.id}>{user.fullName ?? user.email}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Name</span>
      <input
        type="text"
        placeholder="e.g. Salary"
        bind:value={newSourceName}
        class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Expected amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={newSourceAmount}
        class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <button
      type="submit"
      disabled={creatingSource}
      class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {creatingSource ? 'Adding…' : 'Add income source'}
    </button>
  </form>

  <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Expenses</h2>
  <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Line</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Due</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Projected</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Actual</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.expenses.lines as line (line.key)}
          {@const editable = line.key.startsWith('utility-') || line.key.startsWith('category-')}
          {#if editingExpenseKey === line.key}
            <tr class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{line.label}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400"
                >{dueLabel(line)}</td
              >
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
                >{formatCurrency(line.projected)}</td
              >
              <td class="px-3 py-2 text-right">
                {#if editExpenseMode === 'category-multiple'}
                  <span class="text-xs text-slate-500 dark:text-slate-400">Multiple entries</span>
                {:else}
                  <input
                    type="number"
                    step="0.01"
                    bind:value={editExpenseAmount}
                    class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                {/if}
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                {#if editExpenseMode === 'category-multiple'}
                  <a
                    href="/categories/{editExpenseCategoryId}"
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    View all →
                  </a>
                {:else}
                  <button
                    type="button"
                    onclick={saveExpenseEdit}
                    disabled={savingExpense}
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Save
                  </button>
                  {#if editExpenseMode === 'category-edit'}
                    <button
                      type="button"
                      onclick={removeExpenseActual}
                      class="ml-2 text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  {/if}
                {/if}
                <button
                  type="button"
                  onclick={cancelEditExpense}
                  class="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </td>
            </tr>
          {:else}
            <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{line.label}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400"
                >{dueLabel(line)}</td
              >
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
                >{formatCurrency(line.projected)}</td
              >
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
                >{formatCurrency(line.actual)}</td
              >
              <td class="px-3 py-2 text-right whitespace-nowrap">
                {#if editable}
                  <button
                    type="button"
                    onclick={() => startEditExpense(line)}
                    class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                  >
                    Edit
                  </button>
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t border-slate-200 font-semibold dark:border-slate-700">
          <td class="px-3 py-2 text-slate-900 dark:text-slate-100" colspan="2">Total</td>
          <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
            >{formatCurrency(data.expenses.projectedTotal)}</td
          >
          <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
            >{formatCurrency(data.expenses.actualTotal)}</td
          >
          <td class="px-3 py-2"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">
    Income entries this month
  </h2>
  <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Source</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Amount</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Note</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each entries as entry (entry.id)}
          <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
            <td class="px-3 py-2 text-slate-900 dark:text-slate-100">
              {sourceName(entry.incomeSourceId)}
            </td>
            <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
              >{formatCurrency(entry.amount)}</td
            >
            <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(entry.receivedOn)}</td>
            <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{entry.note ?? '—'}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <button
                type="button"
                onclick={() => handleDeleteEntry(entry)}
                class="text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
              >
                Remove
              </button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No income logged for this month yet.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <form
    onsubmit={handleLogEntry}
    class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Source</span>
      <select
        bind:value={logSourceId}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">Unattributed</option>
        {#each sources as source (source.id)}
          <option value={source.id}>{source.name}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={logAmount}
        class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Received on</span>
      <input
        type="date"
        bind:value={logReceivedOn}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Note</span>
      <input
        type="text"
        placeholder="optional"
        bind:value={logNote}
        class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <button
      type="submit"
      disabled={loggingEntry}
      class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    >
      {loggingEntry ? 'Logging…' : 'Log income'}
    </button>
  </form>
{/if}
