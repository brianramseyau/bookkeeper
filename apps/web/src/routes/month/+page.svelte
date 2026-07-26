<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
  import {
    getStandardMonth,
    type StandardMonthResult,
    type StandardMonthLine,
  } from '$lib/api/standard-month'
  import { setMonthCarryover } from '$lib/api/month-carryover'
  import {
    listIncomeSources,
    listIncomeEntries,
    createIncomeEntry,
    updateIncomeEntry,
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
  import { upsertRecurringBillPayment } from '$lib/api/recurring-bills'
  import { upsertSubscriptionPayment } from '$lib/api/subscriptions'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { formatCurrency, formatDate, formatRelativeDate, daysUntil, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'

  // Mirrors the API's DUE_SOON_WINDOW_DAYS (recurring_bills_controller.ts) so
  // the Due chip here matches the Bills page: colored (and always
  // shown) once a line is overdue or due within 30 days, plain text otherwise.
  const DUE_SOON_WINDOW_DAYS = 30

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const yearParam = Number(page.url.searchParams.get('year'))
  const monthParam = Number(page.url.searchParams.get('month'))
  const hasValidMonthParam = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12

  let year = $state(Number.isInteger(yearParam) && yearParam > 0 ? yearParam : currentYear)
  let month = $state(hasValidMonthParam ? monthParam : currentMonth)
  let data = $state<StandardMonthResult | null>(null)
  let sources = $state<IncomeSource[]>([])
  let entries = $state<IncomeEntry[]>([])
  let users = $state<UserSummary[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  let editingCarryover = $state(false)
  let editCarryoverAmount = $state<number>(NaN)
  let savingCarryover = $state(false)

  let logSourceId = $state('')
  let logAmount = $state<number>(NaN)
  let logReceivedOn = $state('')
  let logNote = $state('')
  let loggingEntry = $state(false)

  let editingEntryId = $state<number | null>(null)
  let editEntryAmount = $state<number>(NaN)
  let editEntryReceivedOn = $state('')
  let editEntryNote = $state('')
  let savingEntryEdit = $state(false)

  type ExpenseEditMode = 'utility' | 'category-add' | 'category-edit' | 'category-multiple'
  let editingExpenseKey = $state<string | null>(null)
  let editExpenseMode = $state<ExpenseEditMode | null>(null)
  let editExpenseTargetId = $state<number | null>(null)
  let editExpenseCategoryId = $state<number | null>(null)
  let editExpenseAmount = $state<number>(NaN)
  let savingExpense = $state(false)
  let savingPaidKey = $state<string | null>(null)

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
      error = err instanceof ApiError ? err.message : 'Failed to load monthly view'
    } finally {
      loading = false
    }
  }

  const isCurrentMonth = $derived(year === currentYear && month === currentMonth)

  function clearUrlParams() {
    if (page.url.search) {
      replaceState('/month', {})
    }
  }

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
    clearUrlParams()
    void load()
  }

  function goToCurrentMonth() {
    year = currentYear
    month = currentMonth
    clearUrlParams()
    void load()
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

  function startEditEntry(entry: IncomeEntry) {
    editingEntryId = entry.id
    editEntryAmount = entry.amount
    editEntryReceivedOn = entry.receivedOn ? entry.receivedOn.slice(0, 10) : ''
    editEntryNote = entry.note ?? ''
  }

  function cancelEditEntry() {
    editingEntryId = null
  }

  async function saveEntryEdit(entry: IncomeEntry) {
    if (Number.isNaN(editEntryAmount)) {
      error = 'Amount is required'
      return
    }
    savingEntryEdit = true
    error = null
    try {
      await updateIncomeEntry(entry.id, {
        amount: editEntryAmount,
        receivedOn: editEntryReceivedOn === '' ? null : editEntryReceivedOn,
        note: editEntryNote.trim() === '' ? null : editEntryNote.trim(),
      })
      editingEntryId = null
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEntryEdit = false
    }
  }

  function entriesForSourceId(sourceId: number | null): IncomeEntry[] {
    return entries
      .filter((entry) => entry.incomeSourceId === sourceId)
      .sort((a, b) => (a.receivedOn ?? '').localeCompare(b.receivedOn ?? ''))
  }

  function lastDayOfMonthIso(y: number, m: number): string {
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  }

  // `dueDay` is a bare day-of-month (from a monthly recurring bill, which
  // has no month/year of its own) - resolve it against the month currently
  // being viewed, clamping to that month's last day (e.g. a due day of 31
  // in February).
  //
  // A utility's `dueDate` is a *predicted* payment date - for a non-monthly
  // utility (e.g. quarterly Water, paid in arrears) it's populated as soon
  // as the viewed month is cued up to be the next billing month, even
  // before that quarter's bill has actually been entered. Only surface it
  // once this month's actual is known; otherwise there's nothing concrete
  // due yet and it should read as "-", not a countdown to a guessed date.
  function resolveDueDate(line: StandardMonthLine): string | null {
    if (line.dueDate) return line.actual !== null ? line.dueDate : null
    if (line.dueDay) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const day = Math.min(line.dueDay, daysInMonth)
      return new Date(Date.UTC(year, month - 1, day)).toISOString()
    }
    return null
  }

  function dueLabel(line: StandardMonthLine): string {
    return formatRelativeDate(resolveDueDate(line))
  }

  function dueTitle(line: StandardMonthLine): string | undefined {
    const dueDate = resolveDueDate(line)
    return dueDate ? formatDate(dueDate) : undefined
  }

  // Same red/amber pill as the Bills page's due-soon badge, so the
  // two areas read consistently - null means "plain text, no chip" (a due
  // date more than DUE_SOON_WINDOW_DAYS away, or no due date at all). `paid`
  // (a real, user-set flag - see the Paid checkbox below) is the sole
  // authority on green vs red/amber: it's a separate fact from whether the
  // amount is merely known, which `actual` already covers via
  // resolveDueDate's own gate above.
  function dueChipClass(line: StandardMonthLine): string | null {
    const dueDate = resolveDueDate(line)
    if (!dueDate) return null
    if (line.paid) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    }
    const days = daysUntil(dueDate)
    if (days > DUE_SOON_WINDOW_DAYS) return null
    return days < 0
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }

  // Re-fetches just the standard-month figures (totals, paid flags) without
  // touching `loading` - toggling `loading` swaps the whole page to a
  // "Loading…" placeholder, which unmounts the tables and is what caused the
  // scroll-to-top jump on every Paid click.
  async function refreshMonth() {
    data = await getStandardMonth(year, month)
  }

  async function togglePaid(line: StandardMonthLine, paid: boolean) {
    error = null
    savingPaidKey = line.key
    try {
      if (line.key.startsWith('utility-') && line.actual !== null) {
        const utilityId = Number(line.key.slice('utility-'.length))
        await upsertUtilityBill(utilityId, year, month, line.actual, paid)
      } else if (line.key.startsWith('recurring-bill-')) {
        const recurringBillId = Number(line.key.slice('recurring-bill-'.length))
        await upsertRecurringBillPayment(recurringBillId, year, month, paid)
      } else if (line.key.startsWith('subscription-')) {
        const subscriptionId = Number(line.key.slice('subscription-'.length))
        await upsertSubscriptionPayment(subscriptionId, year, month, paid)
      }
      await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update paid status'
    } finally {
      savingPaidKey = null
    }
  }

  const sortedExpenseLines = $derived(
    data
      ? [...data.expenses.lines].sort((a, b) => {
          const aDate = resolveDueDate(a)
          const bDate = resolveDueDate(b)
          if (aDate && bDate) return new Date(aDate).getTime() - new Date(bDate).getTime()
          if (aDate) return -1
          if (bDate) return 1
          return 0
        })
      : []
  )

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

<svelte:head>
  <title>Monthly · Bookkeeper</title>
</svelte:head>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Monthly</h1>
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
      {monthName(month)}
      {year}
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
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
    <div
      class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
      <p
        class="text-xs font-medium text-slate-500 dark:text-slate-400"
        title="Actual net minus projected net"
      >
        Variance
      </p>
      <p
        class={[
          'mt-1 text-2xl font-semibold',
          data.actualNet - data.projectedNet >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400',
        ]}
      >
        {formatCurrency(data.actualNet - data.projectedNet)}
      </p>
    </div>
  </div>

  <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Expenses</h2>
  <div
    class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Line</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Due</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Projected</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Actual</th
          >
          <th class="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400"
            >Paid</th
          >
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedExpenseLines as line (line.key)}
          {@const editable =
            (line.key.startsWith('utility-') && line.editable) || line.key.startsWith('category-')}
          {#if editingExpenseKey === line.key}
            <tr
              class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
            >
              <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{line.label}</td>
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400" title={dueTitle(line)}>
                {#if dueChipClass(line)}
                  <span class={['rounded-full px-2 py-0.5 text-xs font-medium', dueChipClass(line)]}
                    >{dueLabel(line)}</span
                  >
                {:else}
                  {dueLabel(line)}
                {/if}
              </td>
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
              <td class="px-3 py-2 text-center">
                {#if resolveDueDate(line)}
                  <input
                    type="checkbox"
                    checked={line.paid}
                    disabled={savingPaidKey === line.key}
                    onchange={(e) => togglePaid(line, e.currentTarget.checked)}
                    aria-label="Paid"
                    class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
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
              <td class="px-3 py-2 text-slate-600 dark:text-slate-400" title={dueTitle(line)}>
                {#if dueChipClass(line)}
                  <span class={['rounded-full px-2 py-0.5 text-xs font-medium', dueChipClass(line)]}
                    >{dueLabel(line)}</span
                  >
                {:else}
                  {dueLabel(line)}
                {/if}
              </td>
              <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
                >{formatCurrency(line.projected)}</td
              >
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100"
                >{formatCurrency(line.actual)}</td
              >
              <td class="px-3 py-2 text-center">
                {#if resolveDueDate(line)}
                  <input
                    type="checkbox"
                    checked={line.paid}
                    disabled={savingPaidKey === line.key}
                    onchange={(e) => togglePaid(line, e.currentTarget.checked)}
                    aria-label="Paid"
                    class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                  />
                {/if}
              </td>
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
          <td class="px-3 py-2"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="mt-8 flex items-center justify-between">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Income</h2>
    <a
      href="/income"
      class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
    >
      Manage income sources →
    </a>
  </div>
  <div
    class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
  >
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Source</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Owner</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Projected</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Actual</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Note</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.income.lines as line (line.key)}
          <tr
            class="border-b border-slate-100 bg-slate-50 last:border-0 dark:border-slate-700/60 dark:bg-slate-800/60"
          >
            <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
              {line.label}
              {#if line.payDates.length > 0}
                <span class="block text-xs font-normal text-slate-400 dark:text-slate-500">
                  {line.payDates.length > 2
                    ? `${line.payDates.length} pay periods: `
                    : ''}{line.payDates.map((d) => formatDate(d)).join(', ')}
                </span>
              {/if}
            </td>
            <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
              {line.userId !== null
                ? (users.find((u) => u.id === line.userId)?.fullName ?? '—')
                : '—'}
            </td>
            <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400"
              >{formatCurrency(line.projected)}</td
            >
            <td class="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(line.actual)}
              {#if line.estimated}
                <span
                  class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500"
                  title="No entry logged this month - showing the projected amount"
                >
                  (est.)
                </span>
              {/if}
            </td>
            <td class="px-3 py-2" colspan="3"></td>
          </tr>
          {#each entriesForSourceId(line.sourceId) as entry (entry.id)}
            {#if editingEntryId === entry.id}
              <tr
                class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
              >
                <td class="px-3 py-2" colspan="3"></td>
                <td class="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={editEntryAmount}
                    class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    type="date"
                    bind:value={editEntryReceivedOn}
                    class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    type="text"
                    bind:value={editEntryNote}
                    class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => saveEntryEdit(entry)}
                    disabled={savingEntryEdit}
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onclick={cancelEditEntry}
                    class="ml-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            {:else}
              <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                <td class="px-3 py-2" colspan="3"></td>
                <td class="px-3 py-2 text-right text-slate-700 dark:text-slate-300"
                  >{formatCurrency(entry.amount)}</td
                >
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400"
                  >{formatDate(entry.receivedOn)}</td
                >
                <td class="px-3 py-2 text-slate-500 dark:text-slate-400">{entry.note ?? '—'}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => startEditEntry(entry)}
                    class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onclick={() => handleDeleteEntry(entry)}
                    class="ml-2 text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/if}
          {/each}
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
          <td class="px-3 py-2" colspan="3"></td>
        </tr>
      </tfoot>
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
