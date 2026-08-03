<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { replaceState } from '$app/navigation'
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
  import { formatCurrency, formatDate, formatRelativeDate, daysUntil, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import HelpTooltip from '$lib/components/HelpTooltip.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete, mdiCheckBold } from '@mdi/js'
  import IncomeEntryForm, {
    type IncomeEntryFormValues,
  } from '$lib/components/IncomeEntryForm.svelte'

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
      replaceState('/monthly', {})
    }
  }

  // Mirrors the format the Dashboard's graph links use (see onSelectMonth in
  // routes/+page.svelte) so the URL can be copy/pasted or reloaded to return
  // to the same month.
  function setUrlParams(y: number, m: number) {
    replaceState(`/monthly?year=${y}&month=${m}`, {})
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
    setUrlParams(year, month)
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
    if (Number.isNaN(editCarryoverAmount) || editCarryoverAmount === null) return
    savingCarryover = true
    error = null
    try {
      await setMonthCarryover(year, month, editCarryoverAmount)
      editingCarryover = false
      await refreshMonth()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save carried-over balance'
    } finally {
      savingCarryover = false
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

  // Sourced lines with the projected 1-2 (occasionally 3) pay dates for the
  // month pair each already-logged entry with a pay date positionally, in
  // chronological order - the common case where entries are logged roughly
  // in the order they're paid. Any pay date left over becomes a placeholder
  // row; any entry left over (more entries than known pay dates) just
  // renders as a normal extra row with no aligned projected figure.
  // Unattributed ("Other income") lines always have no pay dates, so they
  // only ever produce 'actual' rows here, unchanged from before.
  type IncomeRow =
    | { type: 'actual'; key: string; entry: IncomeEntry; projected: number | null }
    | { type: 'placeholder'; key: string; date: string; projected: number }

  function round2(value: number): number {
    return Math.round(value * 100) / 100
  }

  function incomeRowsForLine(line: StandardMonthIncomeLine): IncomeRow[] {
    const lineEntries = entriesForLine(line)
    const perPeriod =
      line.payDates.length > 0 ? round2(line.projected / line.payDates.length) : null
    const rows: IncomeRow[] = []
    const count = Math.max(lineEntries.length, line.payDates.length)
    for (let i = 0; i < count; i++) {
      const date = line.payDates[i]
      if (i < lineEntries.length) {
        const entry = lineEntries[i]!
        rows.push({
          type: 'actual',
          key: `entry-${entry.id}`,
          entry,
          projected: date !== undefined ? perPeriod : null,
        })
      } else if (date !== undefined) {
        rows.push({
          type: 'placeholder',
          key: `placeholder-${line.key}-${date}`,
          date,
          projected: perPeriod!,
        })
      }
    }
    return rows
  }

  function entryRowLabel(entry: IncomeEntry): string {
    return entry.receivedOn ? `entry from ${formatDate(entry.receivedOn)}` : 'entry'
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

  // An unattributed ("Other income") line is now per-person - entries.match
  // needs the line's userId too, or two people's unattributed lines would
  // each render every unattributed entry regardless of whose it is.
  function entriesForLine(line: StandardMonthIncomeLine): IncomeEntry[] {
    return entries
      .filter((entry) =>
        line.sourceId !== null
          ? entry.incomeSourceId === line.sourceId
          : entry.incomeSourceId === null && entry.userId === line.userId
      )
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
  // before that quarter's bill has actually been entered. Once this
  // month's actual is known the date is a confirmed fact; until then it's
  // still shown (see `dueDateEstimated`) but flagged as a guess rather than
  // suppressed outright.
  function resolveDueDate(line: StandardMonthLine): string | null {
    if (line.dueDate) return line.dueDate
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
    if (!dueDate) return undefined
    return line.dueDateEstimated
      ? `${formatDate(dueDate)} (estimated from the average received date of past bills)`
      : formatDate(dueDate)
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
    // An estimated date isn't a real obligation yet, so it never earns the
    // red/amber urgency styling - just plain text with an "(est.)" marker
    // (see the template).
    if (line.dueDateEstimated) return null
    if (line.paid) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    }
    const days = daysUntil(dueDate)
    if (days > DUE_SOON_WINDOW_DAYS) return null
    return days < 0
      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }

  // Expense lines have no due date (they're not a single billed obligation
  // like a utility/recurring bill/subscription, just an aggregate of
  // whatever actuals were logged), so gating the checkbox on resolveDueDate
  // like the other line types would hide it for every expense, always.
  // Instead, show it whenever there's an actual to reconcile against - an
  // expense with nothing logged this month (actual === null) has nothing
  // to mark paid.
  function canTrackPaid(line: StandardMonthLine): boolean {
    if (line.key.startsWith('expense-')) return line.actual !== null
    // A guessed due date isn't a real obligation yet - nothing to mark paid
    // against until the bill actually arrives.
    if (line.dueDateEstimated) return false
    return resolveDueDate(line) !== null
  }

  // `estimated` covers both `actual` and `paid` for a recurring bill or
  // subscription (no payment row this far back means neither is real), but
  // only `paid` for an expense - its `actual` is always genuinely logged
  // spending whenever it's non-null (see standard_month_service.ts), so
  // flagging it here too would mislabel real data as a guess.
  function actualIsAssumed(line: StandardMonthLine): boolean {
    return line.estimated && !line.key.startsWith('expense-')
  }

  // The checkbox itself stays visible even when it can't be tracked yet
  // (greyed out via `disabled`) rather than disappearing, so the column
  // reads consistently row to row - this explains why to anyone who hovers.
  function paidTooltip(line: StandardMonthLine): string | undefined {
    // Takes priority over the disabled-state tooltips below - an assumed
    // line is usually still trackable (canTrackPaid true), so without this
    // check hovering it would show no tooltip at all despite the value on
    // screen not being a real record.
    if (line.estimated) {
      return "No record for this month this far back - assumed paid at today's amount because it's in the past. Confirm or correct it."
    }
    if (canTrackPaid(line)) return undefined
    if (line.key.startsWith('expense-')) {
      return 'No actual amount logged for this expense this month'
    }
    return line.actual === null
      ? 'No actual amount recorded for this month yet'
      : 'No due date to reconcile against this month'
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

  // Maps an expense line back to the page where it's actually managed, so
  // its label can link there - a recurring bill's row on that page carries
  // a matching `bill-{id}` anchor (see bills/+page.svelte). Subscriptions
  // have no per-item detail view and are filtered by a person
  // tab with no owner on this line to pre-select, so they link to the list
  // page only.
  function viewHref(line: StandardMonthLine): string | null {
    if (line.key.startsWith('utility-')) return `/utilities/${line.key.slice('utility-'.length)}`
    if (line.key.startsWith('recurring-bill-')) {
      return `/bills#bill-${line.key.slice('recurring-bill-'.length)}`
    }
    if (line.key.startsWith('subscription-')) return '/subscriptions'
    if (line.key.startsWith('expense-')) return `/expenses/${line.key.slice('expense-'.length)}`
    return null
  }
</script>

<PageHead title="Monthly" />

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
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else if data}
  <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card class="flex flex-col p-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Cash on hand</p>
      <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {formatCurrency(data.carryover + data.income.actualTotal)}
      </p>
      <p class="mt-auto pt-2 text-xs text-slate-400 dark:text-slate-500">
        Carried over ({formatCurrency(data.carryover)}) plus actual income received so far ({formatCurrency(
          data.income.actualTotal
        )}), before this month's expenses.
      </p>
    </Card>
    <Card class="flex flex-col p-4">
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
      <p class="mt-auto pt-2 text-xs text-slate-400 dark:text-slate-500">
        Carried over plus projected income, minus projected expenses for the whole month.
      </p>
    </Card>
    <Card class="flex flex-col p-4">
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
      <p class="mt-auto pt-2 text-xs text-slate-400 dark:text-slate-500">
        Carried over plus actual income received, minus actual expenses paid so far.
      </p>
    </Card>
    <Card class="flex flex-col p-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Variance</p>
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
      <p class="mt-auto pt-2 text-xs text-slate-400 dark:text-slate-500">
        Actual net (so far) minus projected net.
      </p>
    </Card>
  </div>

  <h2 class="mt-8 text-lg font-semibold text-slate-900 dark:text-slate-100">Outgoing</h2>
  <Card class="mt-3 sm:overflow-x-auto">
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
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
      <tbody class="block sm:table-row-group">
        {#each sortedExpenseLines as line (line.key)}
          {@const editable =
            (line.key.startsWith('utility-') && line.editable) ||
            line.key.startsWith('recurring-bill-') ||
            line.key.startsWith('subscription-') ||
            line.key.startsWith('expense-')}
          {#if editingExpenseKey === line.key}
            <tr
              class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
            >
              <td class="px-3 py-2 font-medium text-slate-900 sm:table-cell dark:text-slate-100">
                {#if viewHref(line)}
                  <a
                    href={viewHref(line)}
                    class="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                  >
                    {line.label}
                  </a>
                {:else}
                  {line.label}
                {/if}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                title={editExpenseMode === 'utility' ? undefined : dueTitle(line)}
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >{editExpenseMode === 'utility' ? 'Received' : 'Due'}</span
                >
                {#if editExpenseMode === 'utility'}
                  <input
                    type="date"
                    bind:value={editExpenseReceivedOn}
                    class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                {:else if dueChipClass(line)}
                  <span class={['rounded-full px-2 py-0.5 text-xs font-medium', dueChipClass(line)]}
                    >{dueLabel(line)}</span
                  >
                {:else}
                  {dueLabel(line)}
                {/if}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Projected</span
                >
                {formatCurrency(line.projected)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Actual</span
                >
                {#if editExpenseMode === 'expense-multiple'}
                  <span class="text-xs text-slate-500 dark:text-slate-400">Multiple entries</span>
                {:else}
                  <input
                    type="number"
                    step="0.01"
                    bind:value={editExpenseAmount}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                {/if}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-center"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Paid</span
                >
                <input
                  type="checkbox"
                  checked={line.paid}
                  disabled={savingPaidKey === line.key || !canTrackPaid(line)}
                  onchange={(e) => togglePaid(line, e.currentTarget.checked)}
                  aria-label="Paid"
                  title={paidTooltip(line)}
                  class={[
                    'h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600',
                    line.estimated ? 'text-amber-500 dark:text-amber-400' : 'text-indigo-600',
                  ]}
                />
              </td>
              <td
                class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                {#if editExpenseMode === 'expense-multiple'}
                  <a
                    href="/expenses/{editActualsExpenseId}"
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    View all →
                  </a>
                {:else}
                  <IconActionButton
                    variant="primary"
                    disabled={savingExpense}
                    label="Save {line.label}"
                    path={mdiContentSave}
                    onclick={saveExpenseEdit}
                  />
                  {#if editExpenseMode === 'expense-edit'}
                    <IconActionButton
                      variant="danger"
                      label="Delete {line.label} entry"
                      path={mdiDelete}
                      onclick={removeExpenseActual}
                    />
                  {/if}
                {/if}
                <IconActionButton
                  variant="cancel"
                  label="Cancel editing {line.label}"
                  path={mdiCloseThick}
                  onclick={cancelEditExpense}
                />
              </td>
            </tr>
          {:else}
            <tr
              class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
            >
              <td
                class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
              >
                <span class="min-w-0 truncate">
                  {#if viewHref(line)}
                    <a
                      href={viewHref(line)}
                      class="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                    >
                      {line.label}
                    </a>
                  {:else}
                    {line.label}
                  {/if}
                </span>
                {#if editable}
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {line.label}"
                      path={mdiPencil}
                      onclick={() => startEditExpense(line)}
                    />
                  </span>
                {/if}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                title={dueTitle(line)}
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Due</span
                >
                {#if dueChipClass(line)}
                  <span class={['rounded-full px-2 py-0.5 text-xs font-medium', dueChipClass(line)]}
                    >{dueLabel(line)}</span
                  >
                {:else if line.dueDateEstimated}
                  <span
                    >{dueLabel(line)}<span
                      class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500"
                      >(est.)</span
                    ></span
                  >
                {:else}
                  {dueLabel(line)}
                {/if}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Projected</span
                >
                {formatCurrency(line.projected)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Actual</span
                >
                <span>
                  <span
                    class={[
                      actualIsAssumed(line) &&
                        'font-medium text-amber-600 italic dark:text-amber-400',
                    ]}
                  >
                    {formatCurrency(line.actual)}
                  </span>
                  {#if actualIsAssumed(line)}
                    <HelpTooltip
                      label="Why is {line.label}'s actual amount estimated?"
                      text="No record for this month this far back - showing today's live amount, not necessarily what was actually charged then."
                    />
                  {/if}
                </span>
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-center"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Paid</span
                >
                <input
                  type="checkbox"
                  checked={line.paid}
                  disabled={savingPaidKey === line.key || !canTrackPaid(line)}
                  onchange={(e) => togglePaid(line, e.currentTarget.checked)}
                  aria-label="Paid"
                  title={paidTooltip(line)}
                  class={[
                    'h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600',
                    line.estimated ? 'text-amber-500 dark:text-amber-400' : 'text-indigo-600',
                  ]}
                />
              </td>
              <td
                class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              >
                {#if editable}
                  <IconActionButton
                    variant="neutral"
                    label="Edit {line.label}"
                    path={mdiPencil}
                    onclick={() => startEditExpense(line)}
                  />
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
      <tfoot class="block sm:table-footer-group">
        <tr
          class="mt-1 block border-t border-slate-200 pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0 dark:border-slate-700"
        >
          <td class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100" colspan="2"
            >Total</td
          >
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Projected</span
            >
            {formatCurrency(data.expenses.projectedTotal)}
          </td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Actual</span
            >
            {formatCurrency(data.expenses.actualTotal)}
          </td>
          <td class="hidden px-3 py-2 sm:table-cell"></td>
          <td class="hidden px-3 py-2 sm:table-cell"></td>
        </tr>
      </tfoot>
    </table>
  </Card>

  <div class="mt-8 flex items-center justify-between">
    <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Incoming</h2>
    <a
      href="/income"
      class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
    >
      Manage income sources →
    </a>
  </div>

  <Card class="mt-3 sm:overflow-x-auto">
    <table class="block w-full border-collapse text-sm sm:table sm:table-fixed">
      <colgroup>
        <col class="sm:w-[12%]" />
        <col class="sm:w-[16%]" />
        <col class="sm:w-[14%]" />
        <col class="sm:w-[14%]" />
        <col class="sm:w-[14%]" />
        <col class="sm:w-[25%]" />
        <col class="sm:w-[5%]" />
      </colgroup>
      <tbody class="block sm:table-row-group">
        <tr
          class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800/60"
        >
          <td
            class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
            colspan="3"
          >
            <span class="min-w-0 truncate">Carried over from last month</span>
            {#if !editingCarryover}
              <span class="flex shrink-0 items-center gap-1 sm:hidden">
                <IconActionButton
                  variant="neutral"
                  label="Edit carried over balance"
                  path={mdiPencil}
                  onclick={startEditCarryover}
                />
              </span>
            {/if}
          </td>
          {#if editingCarryover}
            <td class="hidden px-3 py-2 sm:table-cell"></td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Actual</span
              >
              <input
                type="number"
                step="0.01"
                bind:value={editCarryoverAmount}
                class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </td>
            <td
              class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              colspan="2"
            >
              <IconActionButton
                variant="primary"
                disabled={savingCarryover}
                label="Save carried over balance"
                path={mdiContentSave}
                onclick={saveCarryover}
              />
              <IconActionButton
                variant="cancel"
                label="Cancel editing carried over balance"
                path={mdiCloseThick}
                onclick={cancelEditCarryover}
              />
            </td>
          {:else}
            <td class="hidden px-3 py-2 sm:table-cell"></td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Actual</span
              >
              {formatCurrency(data.carryover)}
            </td>
            <td
              class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
              colspan="2"
            >
              <IconActionButton
                variant="neutral"
                label="Edit carried over balance"
                path={mdiPencil}
                onclick={startEditCarryover}
              />
            </td>
          {/if}
        </tr>
      </tbody>
    </table>
  </Card>

  <Card class="mt-3 sm:overflow-x-auto">
    <table class="block w-full border-collapse text-sm sm:table sm:table-fixed">
      <colgroup>
        <col class="sm:w-[12%]" />
        <col class="sm:w-[16%]" />
        <col class="sm:w-[14%]" />
        <col class="sm:w-[14%]" />
        <col class="sm:w-[14%]" />
        <col class="sm:w-[25%]" />
        <col class="sm:w-[5%]" />
      </colgroup>
      <thead class="hidden sm:table-header-group">
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Owner</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Source</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Projected</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Actual</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Note</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each data.income.lines as line (line.key)}
          <tr
            class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800/60 sm:dark:border-slate-700/60"
          >
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Owner</span
              >
              {line.userId !== null
                ? (users.find((u) => u.id === line.userId)?.fullName ?? '—')
                : '—'}
            </td>
            <td class="px-3 py-2 font-medium text-slate-900 sm:table-cell dark:text-slate-100"
              >{line.label}</td
            >
            <td class="hidden px-3 py-2 sm:table-cell"></td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Projected</span
              >
              {formatCurrency(line.projected)}
            </td>
            <td
              class="flex items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
            >
              <span
                class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                >Actual</span
              >
              <span>
                {formatCurrency(line.actual)}
                {#if line.estimated}
                  <span
                    class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500"
                    title="No entry logged this month - showing the projected amount"
                  >
                    (est.)
                  </span>
                {/if}
              </span>
            </td>
            <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
          </tr>
          {#each incomeRowsForLine(line) as row (row.key)}
            {#if row.type === 'actual'}
              {@const entry = row.entry}
              {#if editingEntryId === entry.id}
                <tr
                  class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
                >
                  {#if entry.incomeSourceId === null}
                    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Owner</span
                      >
                      <select
                        bind:value={editEntryUserId}
                        class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-auto dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">Select person</option>
                        {#each users as u (u.id)}
                          <option value={u.id}>{u.fullName ?? u.email}</option>
                        {/each}
                      </select>
                    </td>
                    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                      <label
                        class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                      >
                        <input
                          type="checkbox"
                          bind:checked={editEntryTaxWithheld}
                          class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                        />
                        Withheld
                      </label>
                    </td>
                  {:else}
                    <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
                  {/if}
                  <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Date</span
                    >
                    <input
                      type="date"
                      bind:value={editEntryReceivedOn}
                      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Projected</span
                    >
                    {formatCurrency(row.projected)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Actual</span
                    >
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      bind:value={editEntryAmount}
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Note</span
                    >
                    <input
                      type="text"
                      bind:value={editEntryNote}
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td
                    class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="primary"
                      disabled={savingEntryEdit}
                      label="Save income entry"
                      path={mdiContentSave}
                      onclick={() => saveEntryEdit(entry)}
                    />
                    <IconActionButton
                      variant="cancel"
                      label="Cancel editing income entry"
                      path={mdiCloseThick}
                      onclick={cancelEditEntry}
                    />
                  </td>
                </tr>
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
                >
                  {#if entry.incomeSourceId === null}
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Owner</span
                      >
                      {users.find((u) => u.id === entry.userId)?.fullName ?? '—'}
                    </td>
                    <td class="hidden px-3 py-2 sm:table-cell"></td>
                  {:else}
                    <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
                  {/if}
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:min-h-0 dark:text-slate-400"
                  >
                    <span class="min-w-0 truncate">{formatDate(entry.receivedOn)}</span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
                      <IconActionButton
                        variant="neutral"
                        label="Edit {entryRowLabel(entry)}"
                        path={mdiPencil}
                        onclick={() => startEditEntry(entry)}
                      />
                      <IconActionButton
                        variant="danger"
                        label="Delete {entryRowLabel(entry)}"
                        path={mdiDelete}
                        onclick={() => handleDeleteEntry(entry)}
                      />
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Projected</span
                    >
                    {formatCurrency(row.projected)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-700 sm:table-cell sm:text-right dark:text-slate-300"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Actual</span
                    >
                    {formatCurrency(entry.amount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Note</span
                    >
                    {entry.note ?? '—'}
                  </td>
                  <td
                    class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="neutral"
                      label="Edit {entryRowLabel(entry)}"
                      path={mdiPencil}
                      onclick={() => startEditEntry(entry)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {entryRowLabel(entry)}"
                      path={mdiDelete}
                      onclick={() => handleDeleteEntry(entry)}
                    />
                  </td>
                </tr>
              {/if}
            {:else if editingPlaceholderKey === row.key}
              <tr
                class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
              >
                <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
                <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Date</span
                  >
                  <input
                    type="date"
                    bind:value={editPlaceholderReceivedOn}
                    class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Projected</span
                  >
                  {formatCurrency(row.projected)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Actual</span
                  >
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={editPlaceholderAmount}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Note</span
                  >
                  <input
                    type="text"
                    bind:value={editPlaceholderNote}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td
                  class="flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="primary"
                    disabled={savingPlaceholderEdit}
                    label="Save income entry"
                    path={mdiContentSave}
                    onclick={() => saveNewEntryFromPlaceholder(line)}
                  />
                  <IconActionButton
                    variant="cancel"
                    label="Cancel editing income entry"
                    path={mdiCloseThick}
                    onclick={cancelEditPlaceholder}
                  />
                </td>
              </tr>
            {:else}
              <tr
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 italic last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
              >
                <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
                <td
                  class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:min-h-0 dark:text-slate-500"
                >
                  <span class="min-w-0 truncate">{formatDate(row.date)}</span>
                  <span class="flex shrink-0 items-center gap-1 not-italic sm:hidden">
                    <IconActionButton
                      variant="success"
                      disabled={acceptingPlaceholderKey === row.key}
                      label="Accept projected pay for {formatDate(row.date)}"
                      path={mdiCheckBold}
                      onclick={() => acceptPlaceholder(line, row)}
                    />
                    <IconActionButton
                      variant="neutral"
                      label="Edit projected pay for {formatDate(row.date)}"
                      path={mdiPencil}
                      onclick={() => startEditPlaceholder(row)}
                    />
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Projected</span
                  >
                  {formatCurrency(row.projected)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Actual</span
                  >
                  —
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell dark:text-slate-500"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Note</span
                  >
                  Not yet logged
                </td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="success"
                    disabled={acceptingPlaceholderKey === row.key}
                    label="Accept projected pay for {formatDate(row.date)}"
                    path={mdiCheckBold}
                    onclick={() => acceptPlaceholder(line, row)}
                  />
                  <IconActionButton
                    variant="neutral"
                    label="Edit projected pay for {formatDate(row.date)}"
                    path={mdiPencil}
                    onclick={() => startEditPlaceholder(row)}
                  />
                </td>
              </tr>
            {/if}
          {/each}
        {/each}
      </tbody>
      <tfoot class="block sm:table-footer-group">
        <tr
          class="mt-1 block border-t border-slate-200 pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0 dark:border-slate-700"
        >
          <td class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100" colspan="2"
            >Total</td
          >
          <td class="hidden px-3 py-2 sm:table-cell"></td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Projected</span
            >
            {formatCurrency(data.income.projectedTotal)}
          </td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Actual</span
            >
            {formatCurrency(data.income.actualTotal)}
          </td>
          <td class="hidden px-3 py-2 sm:table-cell" colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  </Card>

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
