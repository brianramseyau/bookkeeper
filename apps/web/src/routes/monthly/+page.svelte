<script lang="ts">
  import { page } from '$app/state'
  import { monthState } from '$lib/stores/month.svelte'
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
  import { lastDayOfMonthIso } from '$lib/standard-month-line'
  import type { IncomeRow } from '$lib/income-rows'
  import { buildUnifiedList } from '$lib/monthly-unified-list'
  import { toast } from 'svelte-sonner'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPlus } from '@mdi/js'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import type { IncomeEntryFormValues } from '$lib/components/IncomeEntryForm.svelte'
  import MonthlyLogIncomeSheet from '$lib/components/monthly/MonthlyLogIncomeSheet.svelte'
  import IncomeEntryEditRow, {
    type IncomeEntryEditTarget,
    type IncomeEntryEditValues,
  } from '$lib/components/IncomeEntryEditRow.svelte'
  import MonthSummary from '$lib/components/monthly/MonthSummary.svelte'
  import MonthlyUnifiedList from '$lib/components/monthly/MonthlyUnifiedList.svelte'
  import OutgoingLineEditSheet, {
    type OutgoingLineEditTarget,
    type OutgoingLineEditValues,
  } from '$lib/components/monthly/OutgoingLineEditSheet.svelte'
  import CarryoverCard from '$lib/components/monthly/CarryoverCard.svelte'

  // Seed the shared month from explicit `?year=&month=` params on entry (a
  // shared link, or the Dashboard chart's click-through) before the first
  // fetch below, so it opens on that month. A plain nav link carries none, so
  // the session's month carries over from wherever it was last set.
  monthState.syncFromUrl(page.url.search)

  const year = $derived(monthState.year)
  const month = $derived(monthState.month)
  // The `year`-`month` the currently-rendered `data` belongs to. While a
  // newly-selected month is still loading this lags behind the picker, so the
  // old month's rows stay on screen but their mutation controls are disabled
  // (see `stale`) - otherwise a Paid toggle could submit the previous month's
  // line under the new month's year/month.
  let dataKey = $state<string | null>(null)
  const currentKey = $derived(`${year}-${month}`)
  const stale = $derived(dataKey !== currentKey)
  // Monotonic id for the latest month-data request (load/refreshMonth/
  // refreshIncome). A response is applied only if it is still the latest, so
  // an in-flight request for a month the user has since left - or one
  // superseded by a newer request for the same month (A → B → A) - can't
  // clobber the data the picker currently points at.
  let requestSeq = 0
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

  // Re-fetches whenever the shared month changes (the picker lives in the
  // app shell, so a step made there - or one made on Dashboard before
  // navigating here - lands as a change to `monthState`, not a local call).
  // Any open edit sheet targets a line from the old month, so it's closed
  // here rather than left able to save against the new one.
  let loadedKey: string | null = null
  $effect(() => {
    const key = `${monthState.year}-${monthState.month}`
    if (key === loadedKey) return
    loadedKey = key
    closeSheets()
    carryoverEdit.cancel()
    void load()
  })

  function closeSheets() {
    expenseEditOpen = false
    expenseEditTarget = null
    entryEditOpen = false
    entryEditTarget = null
    logIncomeOpen = false
  }

  // Only shows the full-page loading state on the very first load - once
  // there's data on screen, changing month/year should re-fetch quietly
  // (see refreshMonth/refreshIncome below) rather than tearing the whole
  // page down to a spinner and back, which used to cause a jarring flash
  // (the page collapsing to nothing, then the bottom-of-page entry form
  // reappearing) on every Prev/Next/This Month click.
  async function load() {
    const requested = `${year}-${month}`
    const seq = ++requestSeq
    if (!data) loading = true
    error = null
    try {
      const [monthResult, sourceList, entryList, userList] = await Promise.all([
        getStandardMonth(year, month),
        listIncomeSources(),
        listIncomeEntries(year, month),
        listUsers(),
      ])
      // A month change (or a newer request) while this was in flight makes this
      // response stale; drop it rather than showing the old month's figures
      // under the new heading, and leave `dataKey`/`requestSeq` so `stale`
      // stays true until the latest request lands.
      if (seq !== requestSeq) return
      data = monthResult
      sources = sourceList
      entries = entryList
      users = userList
      dataKey = requested
    } catch (err) {
      if (seq !== requestSeq) return
      error = err instanceof ApiError ? err.message : 'Failed to load monthly view'
    } finally {
      if (seq === requestSeq) loading = false
    }
  }

  function startEditCarryover() {
    carryoverEdit.start(true, { amount: data?.carryover ?? NaN })
  }

  async function saveCarryover() {
    const amount = carryoverEdit.form?.amount
    if (amount === undefined || Number.isNaN(amount) || amount === null) return
    const requested = `${year}-${month}`
    carryoverEdit.saving = true
    error = null
    try {
      await setMonthCarryover(year, month, amount)
      carryoverEdit.cancel()
      // Only refresh if the month hasn't moved on under the open editor.
      if (requested === currentKey) await refreshMonth()
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
    const target = entryEditTarget
    if (!target || target.type !== 'placeholder' || stale) return
    if (Number.isNaN(values.amount) || values.amount === null) {
      entryEditError = 'Amount is required'
      return
    }
    entryEditSubmitting = true
    entryEditError = null
    error = null
    const receivedOn = values.receivedOn === '' ? null : values.receivedOn
    try {
      // File under the viewed month, same as `acceptPlaceholder` - a
      // weekend-rolled pay date can fall in the previous month, and filing
      // it there would create an entry the current month's list never
      // shows.
      await createIncomeEntry({
        incomeSourceId: target.sourceId,
        year,
        month,
        amount: values.amount,
        receivedOn,
        note: values.note === '' ? null : values.note,
      })
    } catch (err) {
      entryEditError = err instanceof ApiError ? err.message : 'Failed to save changes'
      entryEditSubmitting = false
      return
    }
    entryEditOpen = false
    entryEditTarget = null
    entryEditSubmitting = false
    toast.success('Income entry saved')
    // The sheet is closed now, so a failed re-fetch has to surface on the
    // page rather than in the sheet's own (now unmounted) error.
    try {
      await refreshIncome()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reload income'
    }
  }

  // The one-click accept path - just ratifies the projected amount/date
  // as-is, for the common case where what actually landed matches the
  // projection exactly.
  async function acceptPlaceholder(
    line: StandardMonthIncomeLine,
    row: Extract<IncomeRow, { type: 'placeholder' }>
  ) {
    if (stale) return
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
    const requested = `${year}-${month}`
    const seq = ++requestSeq
    const result = await getStandardMonth(year, month)
    // Drop the refresh if the user has moved to another month (or started a
    // newer request) while it was in flight, so it can't land under the wrong
    // month's controls.
    if (seq !== requestSeq) return
    data = result
    dataKey = requested
  }

  // Same idea as refreshMonth, but also re-fetches income entries - used
  // after logging/editing/deleting an entry, which changes both the entries
  // list and the totals derived from it.
  async function refreshIncome() {
    const requested = `${year}-${month}`
    const seq = ++requestSeq
    const [monthResult, entryList] = await Promise.all([
      getStandardMonth(year, month),
      listIncomeEntries(year, month),
    ])
    if (seq !== requestSeq) return
    data = monthResult
    entries = entryList
    dataKey = requested
  }

  async function togglePaid(line: StandardMonthLine, paid: boolean) {
    if (stale) return
    error = null
    savingPaidKey = line.key
    const requested = currentKey
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
      // The mutation targeted the month selected when it started; if the picker
      // has since moved on, don't re-fetch (which would read the new month and
      // bump `requestSeq` out from under that month's own load).
      if (requested === currentKey) await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update paid status'
    } finally {
      savingPaidKey = null
    }
  }

  const unifiedItems = $derived(
    data ? buildUnifiedList(data.expenses.lines, data.income.lines, entries, year, month) : []
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
      const requested = `${year}-${month}`
      try {
        const actuals = await listExpenseActuals(expenseId, year, month)
        // The month may have moved on while the actuals were loading; opening
        // the sheet now would target a line that belongs to the old month.
        if (requested !== currentKey) return
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
        if (requested !== currentKey) return
        error = err instanceof ApiError ? err.message : 'Failed to load actuals'
      }
    }
  }

  async function saveExpenseEditValues(values: OutgoingLineEditValues) {
    const target = expenseEditTarget
    if (!target || stale) return
    if (Number.isNaN(values.amount) || values.amount === null) {
      expenseEditError = 'Enter an amount'
      return
    }
    expenseEditSubmitting = true
    expenseEditError = null
    error = null
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
        expenseEditSubmitting = false
        return
      }
    } catch (err) {
      expenseEditError = err instanceof ApiError ? err.message : 'Failed to save actual'
      expenseEditSubmitting = false
      return
    }
    closeExpenseEdit()
    expenseEditSubmitting = false
    toast.success(target.mode === 'expense-add' ? 'Entry added' : 'Changes saved')
    // The sheet is closed now, so a failed re-fetch has to surface on the
    // page rather than in the sheet's own (now unmounted) error.
    try {
      await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reload the month'
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

<PageHeader title="Monthly" inlineActions>
  {#snippet actions()}
    <IconActionButton
      variant="primary"
      size="lg"
      label="Log income"
      path={mdiPlus}
      onclick={openLogIncome}
    />
  {/snippet}
</PageHeader>

<div class="mt-3">
  <MonthNavHeader nav={monthState} variant="compact" />
</div>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingSkeleton rows={6} class="mt-6" />
{:else if data}
  <MonthSummary {data} />

  <CarryoverCard
    carryover={data.carryover}
    editState={carryoverEdit}
    disabled={stale}
    onStartEdit={startEditCarryover}
    onSave={saveCarryover}
  />

  <MonthlyUnifiedList
    {year}
    {month}
    items={unifiedItems}
    {users}
    {savingPaidKey}
    {acceptingPlaceholderKey}
    {stale}
    onStartEdit={openEditExpense}
    onTogglePaid={togglePaid}
    onEditPlaceholder={openEditPlaceholder}
    onAcceptPlaceholder={acceptPlaceholder}
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

  <IncomeEntryEditRow
    open={entryEditOpen}
    onOpenChange={(next) => (entryEditOpen = next)}
    target={entryEditTarget}
    {users}
    submitting={entryEditSubmitting}
    error={entryEditError}
    onSave={saveEntryEditValues}
  />
{/if}

<MonthlyLogIncomeSheet
  open={logIncomeOpen}
  onOpenChange={(next) => (logIncomeOpen = next)}
  {sources}
  {users}
  submitting={loggingEntry}
  error={logIncomeError}
  onSubmit={handleLogEntry}
/>
