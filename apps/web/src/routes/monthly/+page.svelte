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
  import { type IncomeRow, entryRowLabel } from '$lib/income-rows'
  import { toast } from 'svelte-sonner'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import { Button } from '$lib/components/ui/button'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import type { IncomeEntryFormValues } from '$lib/components/IncomeEntryForm.svelte'
  import MonthlyLogIncomeSheet from '$lib/components/monthly/MonthlyLogIncomeSheet.svelte'
  import IncomeEntryEditRow, {
    type IncomeEntryEditTarget,
    type IncomeEntryEditValues,
  } from '$lib/components/IncomeEntryEditRow.svelte'
  import MonthSummary from '$lib/components/monthly/MonthSummary.svelte'
  import OutgoingLinesTable from '$lib/components/monthly/OutgoingLinesTable.svelte'
  import OutgoingLineEditSheet, {
    type OutgoingLineEditTarget,
    type OutgoingLineEditValues,
  } from '$lib/components/monthly/OutgoingLineEditSheet.svelte'
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

  // Logging a new entry against the viewed month - see MonthlyLogIncomeSheet.
  let logIncomeOpen = $state(false)
  let loggingEntry = $state(false)
  let logIncomeError = $state<string | null>(null)

  // Backs both an existing entry's edit sheet and a placeholder pay date's
  // "adjust before logging" sheet - see IncomeEntryEditRow.
  let entryEditOpen = $state(false)
  let entryEditTarget = $state<IncomeEntryEditTarget | null>(null)
  let entryEditSubmitting = $state(false)
  let entryEditError = $state<string | null>(null)

  // The one-click accept path bypasses the sheet entirely - just ratifies
  // the projected amount/date as-is, for the common case where what
  // actually landed matches the projection exactly.
  let acceptingPlaceholderKey = $state<string | null>(null)

  // An outgoing line's monthly actual is edited in a sheet, never inline -
  // see OutgoingLineEditSheet. The target is only known once an expense's
  // actuals have been loaded (none / one / several choose the mode).
  let expenseEditOpen = $state(false)
  let expenseEditTarget = $state<OutgoingLineEditTarget | null>(null)
  let expenseEditSubmitting = $state(false)
  let expenseEditError = $state<string | null>(null)
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

  function openLogIncome() {
    logIncomeError = null
    logIncomeOpen = true
  }

  async function handleLogEntry(values: IncomeEntryFormValues): Promise<boolean> {
    if (Number.isNaN(values.amount) || values.amount === null) {
      logIncomeError = 'Amount is required'
      return false
    }
    if (values.incomeSourceId === null && values.userId === null) {
      logIncomeError = 'A person is required for other income'
      return false
    }
    loggingEntry = true
    logIncomeError = null
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
      toast.success('Income entry added')
      return true
    } catch (err) {
      logIncomeError = err instanceof ApiError ? err.message : 'Failed to log income'
      return false
    } finally {
      loggingEntry = false
    }
  }

  async function handleDeleteEntry(entry: IncomeEntry) {
    const confirmed = await confirmDestructive({
      title: `Delete ${entryRowLabel(entry)}?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    error = null
    try {
      await deleteIncomeEntry(entry.id)
      await refreshIncome()
      toast.success('Income entry deleted')
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete entry'
    }
  }

  function openEditEntry(entry: IncomeEntry) {
    entryEditTarget = { type: 'entry', entry }
    entryEditError = null
    entryEditOpen = true
  }

  function openEditPlaceholder(
    line: StandardMonthIncomeLine,
    row: Extract<IncomeRow, { type: 'placeholder' }>
  ) {
    entryEditTarget = {
      type: 'placeholder',
      sourceId: line.sourceId,
      label: line.label,
      date: row.date,
      projectedAmount: row.projected,
    }
    entryEditError = null
    entryEditOpen = true
  }

  async function saveEntryEditValues(values: IncomeEntryEditValues) {
    if (!entryEditTarget) return
    if (Number.isNaN(values.amount) || values.amount === null) {
      entryEditError = 'Amount is required'
      return
    }
    entryEditSubmitting = true
    entryEditError = null
    try {
      if (entryEditTarget.type === 'entry') {
        const entry = entryEditTarget.entry
        if (entry.incomeSourceId === null && values.userId === null) {
          entryEditError = 'A person is required for other income'
          return
        }
        await updateIncomeEntry(entry.id, {
          userId: entry.incomeSourceId === null ? (values.userId ?? undefined) : undefined,
          amount: values.amount,
          receivedOn: values.receivedOn === '' ? null : values.receivedOn,
          note: values.note === '' ? null : values.note,
          taxWithheld: entry.incomeSourceId === null ? values.taxWithheld : undefined,
        })
      } else if (entryEditTarget.type === 'placeholder') {
        await createIncomeEntry({
          incomeSourceId: entryEditTarget.sourceId,
          year,
          month,
          amount: values.amount,
          receivedOn: values.receivedOn === '' ? null : values.receivedOn,
          note: values.note === '' ? null : values.note,
        })
      }
      entryEditOpen = false
      await refreshIncome()
      toast.success('Income entry saved')
    } catch (err) {
      entryEditError = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      entryEditSubmitting = false
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
      toast.success('Income entry saved')
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

  function closeExpenseEdit() {
    expenseEditOpen = false
    expenseEditTarget = null
    expenseEditError = null
  }

  async function openEditExpense(line: StandardMonthLine) {
    error = null
    if (line.key.startsWith('utility-')) {
      expenseEditError = null
      expenseEditTarget = { mode: 'utility', line }
      expenseEditOpen = true
      return
    }
    if (line.key.startsWith('recurring-bill-')) {
      expenseEditError = null
      expenseEditTarget = { mode: 'recurring-bill', line }
      expenseEditOpen = true
      return
    }
    if (line.key.startsWith('subscription-')) {
      expenseEditError = null
      expenseEditTarget = { mode: 'subscription', line }
      expenseEditOpen = true
      return
    }
    if (line.key.startsWith('expense-')) {
      const expenseId = Number(line.key.slice('expense-'.length))
      try {
        const actuals = await listExpenseActuals(expenseId, year, month)
        if (actuals.length === 0) {
          expenseEditTarget = { mode: 'expense-add', line, expenseId }
        } else if (actuals.length === 1) {
          expenseEditTarget = {
            mode: 'expense-edit',
            line,
            expenseId,
            actualId: actuals[0]!.id,
          }
        } else {
          expenseEditTarget = { mode: 'expense-multiple', line, expenseId }
        }
        expenseEditError = null
        expenseEditOpen = true
      } catch (err) {
        error = err instanceof ApiError ? err.message : 'Failed to load actuals'
      }
    }
  }

  async function saveExpenseEditValues(values: OutgoingLineEditValues) {
    const target = expenseEditTarget
    if (!target) return
    if (Number.isNaN(values.amount) || values.amount === null) {
      expenseEditError = 'Enter an amount'
      return
    }
    expenseEditSubmitting = true
    expenseEditError = null
    try {
      const amount = values.amount
      if (target.mode === 'utility') {
        await upsertUtilityBill(
          Number(target.line.key.slice('utility-'.length)),
          year,
          month,
          amount,
          undefined,
          values.receivedOn === '' ? null : values.receivedOn
        )
      } else if (target.mode === 'recurring-bill') {
        await upsertRecurringBillPayment(
          Number(target.line.key.slice('recurring-bill-'.length)),
          year,
          month,
          undefined,
          amount
        )
      } else if (target.mode === 'subscription') {
        await upsertSubscriptionPayment(
          Number(target.line.key.slice('subscription-'.length)),
          year,
          month,
          undefined,
          amount
        )
      } else if (target.mode === 'expense-add' && target.expenseId !== undefined) {
        await createExpenseActual(target.expenseId, {
          occurredOn: lastDayOfMonthIso(year, month),
          amount,
        })
      } else if (target.mode === 'expense-edit' && target.actualId !== undefined) {
        await updateExpenseActual(target.actualId, { amount })
      } else {
        return
      }
      closeExpenseEdit()
      await refreshMonth()
      toast.success(target.mode === 'expense-add' ? 'Entry added' : 'Changes saved')
    } catch (err) {
      expenseEditError = err instanceof ApiError ? err.message : 'Failed to save actual'
    } finally {
      expenseEditSubmitting = false
    }
  }

  async function removeExpenseActual() {
    const target = expenseEditTarget
    if (!target || target.mode !== 'expense-edit' || target.actualId === undefined) return
    const confirmed = await confirmDestructive({
      title: `Delete this ${target.line.label} entry?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    error = null
    try {
      await deleteExpenseActual(target.actualId)
      closeExpenseEdit()
      await refreshMonth()
      toast.success('Entry deleted')
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
    {savingPaidKey}
    onStartEdit={openEditExpense}
    onTogglePaid={togglePaid}
  />

  <OutgoingLineEditSheet
    open={expenseEditOpen}
    onOpenChange={(next) => {
      expenseEditOpen = next
      if (!next) expenseEditTarget = null
    }}
    target={expenseEditTarget}
    submitting={expenseEditSubmitting}
    error={expenseEditError}
    onSave={saveExpenseEditValues}
    onRemove={removeExpenseActual}
  />

  <div class="mt-8 flex items-center justify-between gap-3">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Incoming</h2>
    <div class="flex items-center gap-3">
      <a
        href="/income"
        class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        Manage income sources
      </a>
      <Button size="sm" onclick={openLogIncome}>Log income</Button>
    </div>
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
    {acceptingPlaceholderKey}
    onEditEntry={openEditEntry}
    onDeleteEntry={handleDeleteEntry}
    onEditPlaceholder={openEditPlaceholder}
    onAcceptPlaceholder={acceptPlaceholder}
  />

  <IncomeEntryEditRow
    open={entryEditOpen}
    onOpenChange={(next) => (entryEditOpen = next)}
    target={entryEditTarget}
    {users}
    submitting={entryEditSubmitting}
    error={entryEditError}
    onSave={saveEntryEditValues}
  />

  <MonthlyLogIncomeSheet
    open={logIncomeOpen}
    onOpenChange={(next) => (logIncomeOpen = next)}
    {sources}
    {users}
    submitting={loggingEntry}
    error={logIncomeError}
    onSubmit={handleLogEntry}
  />
{/if}
