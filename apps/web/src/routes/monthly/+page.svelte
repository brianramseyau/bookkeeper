<script lang="ts">
  import { onMount } from 'svelte'
  import { MonthNav } from '$lib/month-nav.svelte'
  import MonthNavHeader from '$lib/components/MonthNavHeader.svelte'
  import { EditState } from '$lib/edit-state.svelte'
  import {
    getStandardMonth,
    type StandardMonthResult,
    type StandardMonthLine,
    type StandardMonthIncomeLine,
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
    listExpenseActuals,
    createExpenseActual,
    updateExpenseActual,
    deleteExpenseActual,
  } from '$lib/api/expense-actuals'
  import { upsertExpensePayment } from '$lib/api/expenses'
  import { upsertRecurringBillPayment } from '$lib/api/recurring-bills'
  import { upsertSubscriptionPayment } from '$lib/api/subscriptions'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { ApiError } from '$lib/api'
  import { lastDayOfMonthIso, resolveDueDate } from '$lib/standard-month-line'
  import type { IncomeRow } from '$lib/income-rows'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import IncomeEntryForm, {
    type IncomeEntryFormValues,
  } from '$lib/components/IncomeEntryForm.svelte'
  import MonthSummary from '$lib/components/monthly/MonthSummary.svelte'
  import OutgoingLinesTable from '$lib/components/monthly/OutgoingLinesTable.svelte'
  import CarryoverCard from '$lib/components/monthly/CarryoverCard.svelte'
  import IncomingTable from '$lib/components/monthly/IncomingTable.svelte'

  const nav = new MonthNav('/monthly', () => void load())
  const year = $derived(nav.year)
  const month = $derived(nav.month)
  let data = $state<StandardMonthResult | null>(null)
  let sources = $state<IncomeSource[]>([])
  let entries = $state<IncomeEntry[]>([])
  let users = $state<UserSummary[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)

  const carryoverEdit = new EditState<true, { amount: number }>()

  let loggingEntry = $state(false)

  let editingEntryId = $state<number | null>(null)
  let editEntryUserId = $state('')
  let editEntryTaxWithheld = $state(false)
  let editEntryAmount = $state<number>(NaN)
  let editEntryReceivedOn = $state('')
  let editEntryNote = $state('')
  let savingEntryEdit = $state(false)

  // Not-yet-logged pay dates render as greyed placeholder rows (see
  // incomeRowsForLine below) - these three cover both ways a placeholder
  // becomes a real IncomeEntry: instant one-click accept, or opening this
  // inline form (pre-filled with the projected amount/date) to adjust first.
  let editingPlaceholderKey = $state<string | null>(null)
  let editPlaceholderAmount = $state<number>(NaN)
  let editPlaceholderReceivedOn = $state('')
  let editPlaceholderNote = $state('')
  let savingPlaceholderEdit = $state(false)
  let acceptingPlaceholderKey = $state<string | null>(null)

  type ExpenseEditMode =
    | 'utility'
    | 'recurring-bill'
    | 'subscription'
    | 'expense-add'
    | 'expense-edit'
    | 'expense-multiple'
  let editingExpenseKey = $state<string | null>(null)
  let editExpenseMode = $state<ExpenseEditMode | null>(null)
  let editExpenseTargetId = $state<number | null>(null)
  let editActualsExpenseId = $state<number | null>(null)
  let editExpenseAmount = $state<number>(NaN)
  let editExpenseReceivedOn = $state('')
  let savingExpense = $state(false)
  let savingPaidKey = $state<string | null>(null)

  onMount(load)

  // Only shows the full-page loading state on the very first load - once
  // there's data on screen, changing month/year should re-fetch quietly
  // (see refreshMonth/refreshIncome below) rather than tearing the whole
  // page down to a spinner and back, which used to cause a jarring flash
  // (the page collapsing to nothing, then the bottom-of-page entry form
  // reappearing) on every Prev/Next/This Month click.
  async function load() {
    if (!data) loading = true
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

  function startEditCarryover() {
    carryoverEdit.start(true, { amount: data?.carryover ?? NaN })
  }

  async function saveCarryover() {
    const amount = carryoverEdit.form?.amount
    if (amount === undefined || Number.isNaN(amount) || amount === null) return
    carryoverEdit.saving = true
    error = null
    try {
      await setMonthCarryover(year, month, amount)
      carryoverEdit.cancel()
      await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save carried-over balance'
    } finally {
      carryoverEdit.saving = false
    }
  }

  async function handleLogEntry(values: IncomeEntryFormValues): Promise<boolean> {
    if (Number.isNaN(values.amount) || values.amount === null) {
      error = 'Amount is required'
      return false
    }
    if (values.incomeSourceId === null && values.userId === null) {
      error = 'A person is required for other income'
      return false
    }
    loggingEntry = true
    error = null
    try {
      await createIncomeEntry({
        incomeSourceId: values.incomeSourceId,
        userId: values.userId,
        year,
        month,
        amount: values.amount,
        receivedOn: values.receivedOn,
        note: values.note,
        taxWithheld: values.incomeSourceId === null ? values.taxWithheld : null,
      })
      await refreshIncome()
      return true
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to log income'
      return false
    } finally {
      loggingEntry = false
    }
  }

  async function handleDeleteEntry(entry: IncomeEntry) {
    error = null
    try {
      await deleteIncomeEntry(entry.id)
      await refreshIncome()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete entry'
    }
  }

  function startEditEntry(entry: IncomeEntry) {
    editingEntryId = entry.id
    editEntryUserId = entry.userId !== null ? String(entry.userId) : ''
    editEntryTaxWithheld = entry.taxWithheld ?? false
    editEntryAmount = entry.amount
    editEntryReceivedOn = entry.receivedOn ? entry.receivedOn.slice(0, 10) : ''
    editEntryNote = entry.note ?? ''
  }

  function cancelEditEntry() {
    editingEntryId = null
  }

  async function saveEntryEdit(entry: IncomeEntry) {
    if (Number.isNaN(editEntryAmount) || editEntryAmount === null) {
      error = 'Amount is required'
      return
    }
    if (entry.incomeSourceId === null && editEntryUserId === '') {
      error = 'A person is required for other income'
      return
    }
    savingEntryEdit = true
    error = null
    try {
      await updateIncomeEntry(entry.id, {
        userId: entry.incomeSourceId === null ? Number(editEntryUserId) : undefined,
        amount: editEntryAmount,
        receivedOn: editEntryReceivedOn === '' ? null : editEntryReceivedOn,
        note: editEntryNote.trim() === '' ? null : editEntryNote.trim(),
        taxWithheld: entry.incomeSourceId === null ? editEntryTaxWithheld : undefined,
      })
      editingEntryId = null
      await refreshIncome()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEntryEdit = false
    }
  }

  function startEditPlaceholder(row: Extract<IncomeRow, { type: 'placeholder' }>) {
    editingPlaceholderKey = row.key
    editPlaceholderAmount = row.projected
    editPlaceholderReceivedOn = row.date.slice(0, 10)
    editPlaceholderNote = ''
  }

  function cancelEditPlaceholder() {
    editingPlaceholderKey = null
  }

  async function saveNewEntryFromPlaceholder(line: StandardMonthIncomeLine) {
    if (Number.isNaN(editPlaceholderAmount) || editPlaceholderAmount === null) {
      error = 'Amount is required'
      return
    }
    savingPlaceholderEdit = true
    error = null
    try {
      await createIncomeEntry({
        incomeSourceId: line.sourceId,
        year,
        month,
        amount: editPlaceholderAmount,
        receivedOn: editPlaceholderReceivedOn === '' ? null : editPlaceholderReceivedOn,
        note: editPlaceholderNote.trim() === '' ? null : editPlaceholderNote.trim(),
      })
      editingPlaceholderKey = null
      await refreshIncome()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save entry'
    } finally {
      savingPlaceholderEdit = false
    }
  }

  // The one-click accept path - just ratifies the projected amount/date
  // as-is, for the common case where what actually landed matches the
  // projection exactly.
  async function acceptPlaceholder(
    line: StandardMonthIncomeLine,
    row: Extract<IncomeRow, { type: 'placeholder' }>
  ) {
    error = null
    acceptingPlaceholderKey = row.key
    try {
      await createIncomeEntry({
        incomeSourceId: line.sourceId,
        year,
        month,
        amount: row.projected,
        receivedOn: row.date.slice(0, 10),
      })
      await refreshIncome()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to accept pay date'
    } finally {
      acceptingPlaceholderKey = null
    }
  }

  // Re-fetches just the standard-month figures (totals, actuals, paid flags,
  // carryover) without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the tables and
  // causes a scroll-to-top jump. Used after any edit that only changes
  // `data` (Paid toggle, expense actual save/remove, carryover save).
  // Income entry mutations use refreshIncome below instead, since those
  // also need to update the entries list itself.
  async function refreshMonth() {
    data = await getStandardMonth(year, month)
  }

  // Same idea as refreshMonth, but also re-fetches income entries - used
  // after logging/editing/deleting an entry, which changes both the entries
  // list and the totals derived from it.
  async function refreshIncome() {
    const [monthResult, entryList] = await Promise.all([
      getStandardMonth(year, month),
      listIncomeEntries(year, month),
    ])
    data = monthResult
    entries = entryList
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
      } else if (line.key.startsWith('expense-')) {
        const expenseId = Number(line.key.slice('expense-'.length))
        await upsertExpensePayment(expenseId, year, month, paid)
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
          const aDate = resolveDueDate(a, year, month)
          const bDate = resolveDueDate(b, year, month)
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
    editActualsExpenseId = null
    editExpenseReceivedOn = ''
  }

  async function startEditExpense(line: StandardMonthLine) {
    error = null
    if (line.key.startsWith('utility-')) {
      editingExpenseKey = line.key
      editExpenseMode = 'utility'
      editExpenseTargetId = Number(line.key.slice('utility-'.length))
      editActualsExpenseId = null
      editExpenseAmount = line.actual ?? NaN
      editExpenseReceivedOn = line.receivedOn?.slice(0, 10) ?? ''
      return
    }
    if (line.key.startsWith('recurring-bill-')) {
      editingExpenseKey = line.key
      editExpenseMode = 'recurring-bill'
      editExpenseTargetId = Number(line.key.slice('recurring-bill-'.length))
      editActualsExpenseId = null
      editExpenseAmount = line.actual ?? line.projected ?? NaN
      return
    }
    if (line.key.startsWith('subscription-')) {
      editingExpenseKey = line.key
      editExpenseMode = 'subscription'
      editExpenseTargetId = Number(line.key.slice('subscription-'.length))
      editActualsExpenseId = null
      editExpenseAmount = line.actual ?? line.projected ?? NaN
      return
    }
    if (line.key.startsWith('expense-')) {
      const expenseId = Number(line.key.slice('expense-'.length))
      try {
        const actuals = await listExpenseActuals(expenseId, year, month)
        editingExpenseKey = line.key
        editActualsExpenseId = expenseId
        if (actuals.length === 0) {
          editExpenseMode = 'expense-add'
          editExpenseTargetId = expenseId
          editExpenseAmount = NaN
        } else if (actuals.length === 1) {
          editExpenseMode = 'expense-edit'
          editExpenseTargetId = actuals[0]!.id
          editExpenseAmount = actuals[0]!.amount
        } else {
          editExpenseMode = 'expense-multiple'
          editExpenseTargetId = expenseId
        }
      } catch (err) {
        error = err instanceof ApiError ? err.message : 'Failed to load actuals'
      }
    }
  }

  async function saveExpenseEdit() {
    if (editExpenseMode === 'expense-multiple' || editExpenseTargetId === null) return
    if (Number.isNaN(editExpenseAmount) || editExpenseAmount === null) return

    savingExpense = true
    error = null
    try {
      if (editExpenseMode === 'utility') {
        await upsertUtilityBill(
          editExpenseTargetId,
          year,
          month,
          editExpenseAmount,
          undefined,
          editExpenseReceivedOn === '' ? null : editExpenseReceivedOn
        )
      } else if (editExpenseMode === 'recurring-bill') {
        await upsertRecurringBillPayment(
          editExpenseTargetId,
          year,
          month,
          undefined,
          editExpenseAmount
        )
      } else if (editExpenseMode === 'subscription') {
        await upsertSubscriptionPayment(
          editExpenseTargetId,
          year,
          month,
          undefined,
          editExpenseAmount
        )
      } else if (editExpenseMode === 'expense-add') {
        await createExpenseActual(editExpenseTargetId, {
          occurredOn: lastDayOfMonthIso(year, month),
          amount: editExpenseAmount,
        })
      } else if (editExpenseMode === 'expense-edit') {
        await updateExpenseActual(editExpenseTargetId, { amount: editExpenseAmount })
      }
      cancelEditExpense()
      await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save actual'
    } finally {
      savingExpense = false
    }
  }

  async function removeExpenseActual() {
    if (editExpenseMode !== 'expense-edit' || editExpenseTargetId === null) return
    error = null
    try {
      await deleteExpenseActual(editExpenseTargetId)
      cancelEditExpense()
      await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to remove actual'
    }
  }
</script>

<PageHead title="Monthly" />

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h1 class="font-display text-ink text-2xl">Monthly</h1>
  <MonthNavHeader {nav} showLabel={false} />
</div>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else if data}
  <MonthSummary {year} {month} {data} />

  <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Outgoing</h2>
  <OutgoingLinesTable
    {year}
    {month}
    lines={sortedExpenseLines}
    projectedTotal={data.expenses.projectedTotal}
    actualTotal={data.expenses.actualTotal}
    {editingExpenseKey}
    {editExpenseMode}
    {editActualsExpenseId}
    bind:editExpenseAmount
    bind:editExpenseReceivedOn
    {savingExpense}
    {savingPaidKey}
    onStartEdit={startEditExpense}
    onCancelEdit={cancelEditExpense}
    onSaveEdit={saveExpenseEdit}
    onRemoveActual={removeExpenseActual}
    onTogglePaid={togglePaid}
  />

  <div class="mt-8 flex items-center justify-between">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Incoming</h2>
    <a
      href="/income"
      class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
    >
      Manage income sources →
    </a>
  </div>

  <CarryoverCard
    carryover={data.carryover}
    editState={carryoverEdit}
    onStartEdit={startEditCarryover}
    onSave={saveCarryover}
  />

  <IncomingTable
    lines={data.income.lines}
    {entries}
    {users}
    projectedTotal={data.income.projectedTotal}
    actualTotal={data.income.actualTotal}
    {editingEntryId}
    bind:editEntryUserId
    bind:editEntryTaxWithheld
    bind:editEntryAmount
    bind:editEntryReceivedOn
    bind:editEntryNote
    {savingEntryEdit}
    {editingPlaceholderKey}
    bind:editPlaceholderAmount
    bind:editPlaceholderReceivedOn
    bind:editPlaceholderNote
    {savingPlaceholderEdit}
    {acceptingPlaceholderKey}
    onStartEditEntry={startEditEntry}
    onCancelEditEntry={cancelEditEntry}
    onSaveEditEntry={saveEntryEdit}
    onDeleteEntry={handleDeleteEntry}
    onStartEditPlaceholder={startEditPlaceholder}
    onCancelEditPlaceholder={cancelEditPlaceholder}
    onSavePlaceholder={saveNewEntryFromPlaceholder}
    onAcceptPlaceholder={acceptPlaceholder}
  />

  <Card class="mt-4 p-4">
    <IncomeEntryForm
      {sources}
      {users}
      allowUnattributed
      submitting={loggingEntry}
      class="flex flex-wrap items-end gap-3"
      onSubmit={handleLogEntry}
    />
  </Card>
{/if}
