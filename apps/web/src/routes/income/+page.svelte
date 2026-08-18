<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listIncomeSources,
    createIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    getIncomeSourcesSummary,
    listAllIncomeEntriesForFinancialYear,
    listIncomeEntries,
    createIncomeEntry,
    updateIncomeEntry,
    deleteIncomeEntry,
    getIncomeYtd,
    type IncomeSource,
    type IncomeSourceFrequency,
    type IncomeSourceSummary,
    type IncomeEntry,
    type IncomeYtdMonth,
  } from '$lib/api/income'
  import { getIncomeTaxSetting, setIncomeTaxSetting } from '$lib/api/income_tax_settings'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { authState } from '$lib/stores/auth.svelte'
  import { themeState } from '$lib/stores/theme.svelte'
  import {
    currentFinancialYear,
    financialYearFor,
    financialYearLabel,
    financialYearMonths,
    formatCurrency,
    formatDate,
    round2,
    todayISO,
  } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import SecondaryButton from '$lib/components/SecondaryButton.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import PieChart, { type PieSlice } from '$lib/components/PieChart.svelte'
  import IncomeYtdChart from '$lib/components/IncomeYtdChart.svelte'
  import YearlyIncomeLineChart from '$lib/components/YearlyIncomeLineChart.svelte'
  import {
    mdiPencil,
    mdiCloseThick,
    mdiContentSave,
    mdiDelete,
    mdiPlus,
    mdiChevronDown,
    mdiBriefcase,
    mdiBank,
  } from '@mdi/js'
  import IncomeEntryForm, {
    type IncomeEntryFormValues,
  } from '$lib/components/IncomeEntryForm.svelte'

  type EntryFilter = 'all' | 'salary' | 'other'

  const FREQUENCIES: { value: IncomeSourceFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'fortnightly', label: 'Fortnightly' },
  ]

  const FILTERS: { value: EntryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'salary', label: 'Salary' },
    { value: 'other', label: 'Other' },
  ]

  let users = $state<UserSummary[]>([])
  let sources = $state<IncomeSource[]>([])
  let summaries = $state<IncomeSourceSummary[]>([])
  let selectedUserId = $state<number | null>(null)
  let selectedFinancialYear = $state(currentFinancialYear())
  let entries = $state<IncomeEntry[]>([])
  let entriesLoading = $state(false)
  let entriesLoaded = $state(false)
  let loading = $state(true)
  let error = $state<string | null>(null)

  let filter = $state<EntryFilter>('all')
  let showAddSource = $state(false)
  let showAddSalary = $state(false)
  let showAddOther = $state(false)

  let name = $state('')
  let expectedAmount = $state<number>(NaN)
  let frequency = $state<IncomeSourceFrequency>('monthly')
  let payDayOfMonth = $state<number>(NaN)
  let weekendRollback = $state(false)
  let anchorDate = $state('')
  let taxWithheld = $state(true)
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editExpectedAmount = $state<number>(NaN)
  let editFrequency = $state<IncomeSourceFrequency>('monthly')
  let editPayDayOfMonth = $state<number>(NaN)
  let editWeekendRollback = $state(false)
  let editAnchorDate = $state('')
  let editTaxWithheld = $state(true)
  let savingEdit = $state(false)

  let loggingEntry = $state(false)
  let editingEntryId = $state<number | null>(null)
  let savingEntryEdit = $state(false)
  let editEntryAmount = $state<number>(NaN)
  let editEntryReceivedOn = $state('')
  let editEntryNote = $state('')

  let itemDate = $state(todayISO())
  let itemName = $state('')
  let itemAmount = $state<number>(NaN)
  let itemTaxWithheld = $state(false)
  let addingItem = $state(false)

  let editingItemId = $state<number | null>(null)
  let editItemDate = $state('')
  let editItemName = $state('')
  let editItemAmount = $state<number>(NaN)
  let editItemTaxWithheld = $state(false)
  let savingItemEdit = $state(false)

  let savedMarginalRate = $state<number | null>(null)
  let marginalRatePercent = $state<number>(NaN)
  let savingMarginalRate = $state(false)

  const visibleSources = $derived(sources.filter((s) => s.userId === selectedUserId))
  const sourceById = $derived(new Map(sources.map((s) => [s.id, s])))

  const salaryEntries = $derived(entries.filter((e) => e.incomeSourceId !== null))
  const otherEntries = $derived(entries.filter((e) => e.incomeSourceId === null))

  const visibleEntries = $derived.by(() => {
    const base = filter === 'all' ? entries : filter === 'salary' ? salaryEntries : otherEntries
    return [...base].sort((a, b) => (b.receivedOn ?? '').localeCompare(a.receivedOn ?? ''))
  })

  const visibleHasOther = $derived(visibleEntries.some((e) => e.incomeSourceId === null))

  const visibleTotals = $derived.by(() => {
    let amount = 0
    let tax = 0
    let gain = 0
    for (const entry of visibleEntries) {
      amount += entry.amount
      if (entry.incomeSourceId === null && !entry.taxWithheld && savedMarginalRate !== null) {
        const itemTax = round2(entry.amount * savedMarginalRate)
        tax += itemTax
        gain += round2(entry.amount - itemTax)
      }
    }
    return { amount: round2(amount), tax: round2(tax), gain: round2(gain) }
  })

  // Both figures are net (usable) income, so the total is a true budget
  // number: salary entries are already net take-home (PAYG withheld at the
  // source), and other income counts its post-marginal-rate gain - or its
  // full amount when tax was withheld at source, or (no rate set yet) the
  // gross sale as the only number available.
  const ytdSummary = $derived.by(() => {
    const salary = round2(salaryEntries.reduce((a, e) => a + e.amount, 0))
    const other = round2(
      otherEntries.reduce(
        (a, e) => a + (e.taxWithheld ? e.amount : (computeItemGain(e) ?? e.amount)),
        0
      )
    )
    return { salary, other, total: round2(salary + other) }
  })

  const emptyMessage = $derived(
    filter === 'all'
      ? `No income logged for ${financialYearLabel(selectedFinancialYear)}.`
      : filter === 'salary'
        ? `No salary income logged for ${financialYearLabel(selectedFinancialYear)}.`
        : `No other income logged for ${financialYearLabel(selectedFinancialYear)}.`
  )

  // --- Charts ---

  const CHART_COLORS = {
    salary: { light: '#4f46e5', dark: '#818cf8' },
    other: { light: '#94a3b8', dark: '#94a3b8' },
  }
  const PERSON_FALLBACK_COLORS = ['#f59e0b', '#10b981', '#ec4899', '#0ea5e9']
  const YEAR_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6']

  let showCharts = $state(false)
  let chartsLoading = $state(false)
  let chartError = $state<string | null>(null)
  let chartDataKey = $state('')
  let allEntries = $state<IncomeEntry[]>([])
  let ytdMonths = $state<IncomeYtdMonth[]>([])
  let taxRates = $state<Map<string, number | null>>(new Map())

  // Salary entries are already net take-home; other income nets through the
  // owner's marginal rate for its financial year, falling back to the gross
  // sale when tax was withheld at source or no rate is set.
  function netOf(entry: IncomeEntry): number {
    if (entry.incomeSourceId !== null || entry.taxWithheld) return entry.amount
    const rate =
      entry.userId === null
        ? null
        : (taxRates.get(`${entry.userId}:${financialYearFor(entry.year, entry.month)}`) ?? null)
    return rate === null ? entry.amount : round2(entry.amount - entry.amount * rate)
  }

  function entryOwnerId(entry: IncomeEntry): number | null {
    if (entry.incomeSourceId !== null) {
      return sourceById.get(entry.incomeSourceId)?.userId ?? null
    }
    return entry.userId
  }

  const selectedYearEntries = $derived(
    allEntries.filter((e) => financialYearFor(e.year, e.month) === selectedFinancialYear)
  )

  const selectedUserLabel = $derived(
    users.find((u) => u.id === selectedUserId)?.fullName ?? 'This person'
  )

  const salaryColor = $derived(
    themeState.current === 'dark' ? CHART_COLORS.salary.dark : CHART_COLORS.salary.light
  )
  const otherColor = $derived(
    themeState.current === 'dark' ? CHART_COLORS.other.dark : CHART_COLORS.other.light
  )

  const salaryVsOtherPie = $derived.by(() => {
    let salary = 0
    let other = 0
    for (const entry of selectedYearEntries) {
      if (entry.incomeSourceId !== null) salary += entry.amount
      else other += netOf(entry)
    }
    const slices: PieSlice[] = []
    if (salary > 0) slices.push({ label: 'Salary', value: round2(salary), color: salaryColor })
    if (other > 0) slices.push({ label: 'Other income', value: round2(other), color: otherColor })
    return slices
  })

  const personPie = $derived.by(() => {
    const totals = new Map<number, number>()
    for (const entry of selectedYearEntries) {
      const owner = entryOwnerId(entry)
      if (owner === null) continue
      totals.set(owner, (totals.get(owner) ?? 0) + netOf(entry))
    }
    return users
      .filter((user) => (totals.get(user.id) ?? 0) > 0)
      .map((user, index) => ({
        label: user.fullName ?? user.email,
        value: round2(totals.get(user.id) ?? 0),
        color: user.displayColor ?? PERSON_FALLBACK_COLORS[index % PERSON_FALLBACK_COLORS.length],
      }))
  })

  const yearlySeries = $derived.by(() => {
    const byYear = new Map<number, IncomeEntry[]>()
    for (const entry of allEntries) {
      const fy = financialYearFor(entry.year, entry.month)
      const bucket = byYear.get(fy) ?? []
      bucket.push(entry)
      byYear.set(fy, bucket)
    }
    const fys = [...byYear.keys()].sort((a, b) => a - b)
    const now = new Date()
    const nowIndex = now.getFullYear() * 12 + now.getMonth()
    return fys.map((fy, index) => {
      let running = 0
      const points: { month: number; total: number }[] = []
      for (const { year, month } of financialYearMonths(fy)) {
        if (year * 12 + month > nowIndex) break
        const net = byYear
          .get(fy)!
          .filter((e) => e.year === year && e.month === month)
          .reduce((sum, e) => sum + netOf(e), 0)
        running += net
        points.push({ month, total: round2(running) })
      }
      return {
        label: financialYearLabel(fy),
        color: YEAR_COLORS[index % YEAR_COLORS.length],
        points,
      }
    })
  })

  const ytdChartData = $derived(
    ytdMonths.map((m) => ({
      year: m.year,
      month: m.month,
      actual: m.actual,
      projected: m.projected,
    }))
  )

  function filterCount(value: EntryFilter): number {
    return value === 'all'
      ? entries.length
      : value === 'salary'
        ? salaryEntries.length
        : otherEntries.length
  }

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      await refresh()
    } finally {
      loading = false
    }
    await loadEntries()
  }

  // Re-fetches without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the table and
  // resets scroll position on every add/edit action.
  async function refresh() {
    try {
      const [userList, sourceList, summaryList] = await Promise.all([
        listUsers(),
        listIncomeSources(),
        getIncomeSourcesSummary(),
      ])
      users = userList
      sources = sourceList
      summaries = summaryList
      if (selectedUserId === null && users.length > 0) {
        const loggedInUserId = authState.user?.id ?? null
        selectedUserId =
          loggedInUserId !== null && users.some((u) => u.id === loggedInUserId)
            ? loggedInUserId
            : users[0]!.id
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load income sources'
    }
  }

  // Fetches every income entry in the financial year for the whole household
  // and filters client-side: source-tied entries by the selected user's
  // sources (entries logged from the Monthly page carry only incomeSourceId,
  // not userId), unattributed entries by userId. This mirrors how the old YTD
  // month expansion filtered its entries. Only shows the section's loading
  // state the first time - once there's data on screen, switching user/year
  // re-fetches quietly rather than tearing the table down to a spinner on
  // every Prev/Next click.
  async function loadEntries() {
    if (selectedUserId === null) return
    if (!entriesLoaded) entriesLoading = true
    try {
      const [entryList, setting] = await Promise.all([
        listAllIncomeEntriesForFinancialYear(selectedFinancialYear),
        getIncomeTaxSetting(selectedUserId, selectedFinancialYear),
      ])
      const visibleIds = new Set(visibleSources.map((s) => s.id))
      entries = entryList.filter(
        (e) =>
          (e.incomeSourceId !== null && visibleIds.has(e.incomeSourceId)) ||
          (e.incomeSourceId === null && e.userId === selectedUserId)
      )
      savedMarginalRate = setting.marginalRate
      marginalRatePercent = setting.marginalRate === null ? NaN : round2(setting.marginalRate * 100)
      entriesLoaded = true
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load income'
    } finally {
      entriesLoading = false
    }
  }

  function resetTransientState() {
    editingId = null
    editingEntryId = null
    editingItemId = null
    showAddSource = false
    showAddSalary = false
    showAddOther = false
  }

  // Charts data is fetched lazily the first time the section is opened for a
  // given (user, financial year) combination; opening the section again for
  // the same selection reuses what's already loaded. Re-fetches whenever the
  // selected user or year changes while the section is open.
  $effect(() => {
    if (!showCharts || selectedUserId === null) return
    const key = `${selectedUserId}:${selectedFinancialYear}`
    if (chartDataKey === key) return
    chartDataKey = key
    void loadChartData()
  })

  async function loadChartData() {
    chartsLoading = true
    chartError = null
    try {
      const [all, ytd] = await Promise.all([
        listIncomeEntries(),
        getIncomeYtd(selectedUserId ?? 0, selectedFinancialYear),
      ])
      allEntries = all
      ytdMonths = ytd.months

      // Per-person marginal rates for every financial year present, so other
      // income can be netted per owner. Bounded: two users x the few years of
      // history the app holds.
      const fys = new Set<number>()
      for (const entry of all) fys.add(financialYearFor(entry.year, entry.month))
      const rates = new Map<string, number | null>()
      await Promise.all(
        users.flatMap((user) =>
          [...fys].map(async (fy) => {
            try {
              const setting = await getIncomeTaxSetting(user.id, fy)
              rates.set(`${user.id}:${fy}`, setting.marginalRate)
            } catch {
              rates.set(`${user.id}:${fy}`, null)
            }
          })
        )
      )
      taxRates = rates
    } catch (err) {
      chartError = err instanceof ApiError ? err.message : 'Failed to load charts'
    } finally {
      chartsLoading = false
    }
  }

  function refreshChartsIfOpen() {
    if (showCharts) void loadChartData()
  }

  // Only one add-form is open at a time - opening any of them closes the
  // other two so the page never stacks forms from different sections.
  function toggleAddSource() {
    showAddSource = !showAddSource
    if (showAddSource) {
      showAddSalary = false
      showAddOther = false
    }
  }

  function toggleAddSalary() {
    showAddSalary = !showAddSalary
    if (showAddSalary) {
      showAddSource = false
      showAddOther = false
    }
  }

  function toggleAddOther() {
    showAddOther = !showAddOther
    if (showAddOther) {
      showAddSource = false
      showAddSalary = false
    }
  }

  function selectUser(userId: number) {
    selectedUserId = userId
    resetTransientState()
    void loadEntries()
  }

  function changeYear(delta: number) {
    selectedFinancialYear += delta
    resetTransientState()
    void loadEntries()
  }

  function cadenceLabel(source: IncomeSource): string {
    if (source.frequency === 'fortnightly') {
      return source.anchorDate
        ? `Fortnightly (from ${source.anchorDate.slice(0, 10)})`
        : 'Fortnightly'
    }
    if (source.payDayOfMonth === null) return 'Monthly'
    return `Monthly, day ${source.payDayOfMonth}${source.weekendRollback ? ' (or preceding Fri)' : ''}`
  }

  async function handleDelete(source: IncomeSource) {
    error = null
    try {
      await deleteIncomeSource(source.id)
      sources = sources.filter((s) => s.id !== source.id)
      summaries = await getIncomeSourcesSummary()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to remove'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (
      selectedUserId === null ||
      !name.trim() ||
      Number.isNaN(expectedAmount) ||
      expectedAmount === null
    ) {
      error = 'Name and expected amount are required'
      return
    }
    if (frequency === 'monthly' && (Number.isNaN(payDayOfMonth) || payDayOfMonth === null)) {
      error = 'Pay day of month is required for a monthly source'
      return
    }
    if (frequency === 'fortnightly' && !anchorDate) {
      error = 'An anchor pay date is required for a fortnightly source'
      return
    }
    creating = true
    error = null
    try {
      await createIncomeSource({
        userId: selectedUserId,
        name: name.trim(),
        expectedAmount,
        frequency,
        payDayOfMonth: frequency === 'monthly' ? payDayOfMonth : undefined,
        weekendRollback: frequency === 'monthly' ? weekendRollback : undefined,
        anchorDate: frequency === 'fortnightly' ? anchorDate : undefined,
        taxWithheld,
      })
      name = ''
      expectedAmount = NaN
      frequency = 'monthly'
      payDayOfMonth = NaN
      weekendRollback = false
      anchorDate = ''
      taxWithheld = true
      showAddSource = false
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add income source'
    } finally {
      creating = false
    }
  }

  function startEdit(source: IncomeSource) {
    editingId = source.id
    editName = source.name
    editExpectedAmount = source.expectedAmount
    editFrequency = source.frequency
    editPayDayOfMonth = source.payDayOfMonth ?? NaN
    editWeekendRollback = source.weekendRollback
    editAnchorDate = source.anchorDate ? source.anchorDate.slice(0, 10) : ''
    editTaxWithheld = source.taxWithheld
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(source: IncomeSource) {
    if (!editName.trim() || Number.isNaN(editExpectedAmount) || editExpectedAmount === null) {
      error = 'Name and expected amount are required'
      return
    }
    if (
      editFrequency === 'monthly' &&
      (Number.isNaN(editPayDayOfMonth) || editPayDayOfMonth === null)
    ) {
      error = 'Pay day of month is required for a monthly source'
      return
    }
    if (editFrequency === 'fortnightly' && !editAnchorDate) {
      error = 'An anchor pay date is required for a fortnightly source'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateIncomeSource(source.id, {
        name: editName.trim(),
        expectedAmount: editExpectedAmount,
        frequency: editFrequency,
        payDayOfMonth: editFrequency === 'monthly' ? editPayDayOfMonth : null,
        weekendRollback: editFrequency === 'monthly' ? editWeekendRollback : false,
        anchorDate: editFrequency === 'fortnightly' ? editAnchorDate : null,
        taxWithheld: editTaxWithheld,
      })
      editingId = null
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }

  function computeItemTax(item: IncomeEntry): number | null {
    if (item.taxWithheld || savedMarginalRate === null) return null
    return round2(item.amount * savedMarginalRate)
  }

  function computeItemGain(item: IncomeEntry): number | null {
    const tax = computeItemTax(item)
    return tax === null ? null : round2(item.amount - tax)
  }

  async function saveMarginalRate() {
    if (
      selectedUserId === null ||
      Number.isNaN(marginalRatePercent) ||
      marginalRatePercent === null
    ) {
      error = 'Marginal tax rate is required'
      return
    }
    savingMarginalRate = true
    error = null
    try {
      const setting = await setIncomeTaxSetting(
        selectedUserId,
        selectedFinancialYear,
        round2(marginalRatePercent / 100)
      )
      savedMarginalRate = setting.marginalRate
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save marginal tax rate'
    } finally {
      savingMarginalRate = false
    }
  }

  function sourceName(sourceId: number | null): string {
    return sourceById.get(sourceId ?? -1)?.name ?? 'Unknown'
  }

  // A salary entry's year/month come from its received-on date - the table
  // is no longer scoped to a particular expanded month.
  async function handleAddSalary(values: IncomeEntryFormValues): Promise<boolean> {
    if (values.incomeSourceId === null || Number.isNaN(values.amount) || values.amount === null) {
      error = 'Source and amount are required'
      return false
    }
    if (!values.receivedOn) {
      error = 'A received-on date is required'
      return false
    }
    const [year, month] = values.receivedOn.split('-').map(Number) as [number, number]
    loggingEntry = true
    error = null
    try {
      await createIncomeEntry({
        incomeSourceId: values.incomeSourceId,
        year,
        month,
        amount: values.amount,
        receivedOn: values.receivedOn,
        note: values.note,
      })
      await loadEntries()
      refreshChartsIfOpen()
      showAddSalary = false
      return true
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to log income'
      return false
    } finally {
      loggingEntry = false
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
    if (Number.isNaN(editEntryAmount) || editEntryAmount === null) {
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
      await loadEntries()
      refreshChartsIfOpen()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEntryEdit = false
    }
  }

  async function handleDeleteEntry(entry: IncomeEntry) {
    error = null
    try {
      await deleteIncomeEntry(entry.id)
      await loadEntries()
      refreshChartsIfOpen()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete entry'
    }
  }

  function resetItemForm() {
    itemDate = todayISO()
    itemName = ''
    itemAmount = NaN
    itemTaxWithheld = false
  }

  async function handleAddItem(event: SubmitEvent) {
    event.preventDefault()
    if (
      selectedUserId === null ||
      !itemDate ||
      !itemName.trim() ||
      Number.isNaN(itemAmount) ||
      itemAmount === null
    ) {
      error = 'Date, item and amount are required'
      return
    }
    addingItem = true
    error = null
    try {
      const [year, month] = itemDate.split('-').map(Number) as [number, number]
      await createIncomeEntry({
        userId: selectedUserId,
        year,
        month,
        amount: itemAmount,
        receivedOn: itemDate,
        note: itemName.trim(),
        taxWithheld: itemTaxWithheld,
      })
      resetItemForm()
      showAddOther = false
      await loadEntries()
      refreshChartsIfOpen()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add item'
    } finally {
      addingItem = false
    }
  }

  function startEditItem(item: IncomeEntry) {
    editingItemId = item.id
    editItemDate = item.receivedOn ? item.receivedOn.slice(0, 10) : ''
    editItemName = item.note ?? ''
    editItemAmount = item.amount
    editItemTaxWithheld = item.taxWithheld ?? false
  }

  function cancelEditItem() {
    editingItemId = null
  }

  async function saveItemEdit(item: IncomeEntry) {
    if (
      !editItemDate ||
      !editItemName.trim() ||
      Number.isNaN(editItemAmount) ||
      editItemAmount === null
    ) {
      error = 'Date, item and amount are required'
      return
    }
    savingItemEdit = true
    error = null
    try {
      const [year, month] = editItemDate.split('-').map(Number) as [number, number]
      await updateIncomeEntry(item.id, {
        year,
        month,
        amount: editItemAmount,
        receivedOn: editItemDate,
        note: editItemName.trim(),
        taxWithheld: editItemTaxWithheld,
      })
      editingItemId = null
      await loadEntries()
      refreshChartsIfOpen()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingItemEdit = false
    }
  }

  async function handleDeleteItem(item: IncomeEntry) {
    error = null
    try {
      await deleteIncomeEntry(item.id)
      await loadEntries()
      refreshChartsIfOpen()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete item'
    }
  }
</script>

<PageHead title="Income" />

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Manage income sources and log salary and other income. Each person's projected income still feeds
  the <a href="/monthly" class="text-indigo-600 hover:underline dark:text-indigo-400">Monthly</a> page.
</p>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else}
  <div class="mt-6 flex gap-2">
    {#each users as user (user.id)}
      {@const summary = summaries.find((s) => s.userId === user.id)}
      <button
        type="button"
        onclick={() => selectUser(user.id)}
        class={[
          'rounded-lg border px-4 py-2 text-left transition-colors',
          selectedUserId === user.id
            ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30'
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-600',
        ]}
      >
        <span class="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          {user.fullName ?? user.email}
        </span>
        <span class="block text-xs text-slate-500 dark:text-slate-400">
          {formatCurrency(summary?.total ?? 0)}/mo · {summary?.count ?? 0} source{summary?.count ===
          1
            ? ''
            : 's'}
        </span>
      </button>
    {/each}
  </div>

  {#if selectedUserId !== null}
    <div class="mt-6 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Income sources</h2>
      <SecondaryButton onclick={toggleAddSource}>
        {showAddSource ? 'Cancel' : 'Add source'}
      </SecondaryButton>
    </div>

    {#if showAddSource}
      <form
        onsubmit={handleAdd}
        class="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
      >
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Name</span>
          <input
            type="text"
            bind:value={name}
            placeholder="e.g. Salary"
            class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
            >Expected per pay</span
          >
          <input
            type="number"
            step="0.01"
            min="0"
            bind:value={expectedAmount}
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
        {#if frequency === 'monthly'}
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Pay day</span>
            <input
              type="number"
              min="1"
              max="31"
              bind:value={payDayOfMonth}
              class="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label
            class="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500 dark:text-slate-400"
          >
            <input
              type="checkbox"
              bind:checked={weekendRollback}
              class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
            />
            Roll to preceding Friday on a weekend
          </label>
        {:else}
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
              >A confirmed real pay date</span
            >
            <input
              type="date"
              bind:value={anchorDate}
              class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        {/if}
        <label class="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            bind:checked={taxWithheld}
            class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
          />
          Tax withheld (PAYG)
        </label>
        <PrimaryButton type="submit" disabled={creating}>
          {creating ? 'Adding…' : 'Add income source'}
        </PrimaryButton>
      </form>
    {/if}

    <Card class="mt-3 sm:overflow-x-auto" pivotTable>
      <table class="block w-full border-collapse text-sm sm:table">
        <thead class="hidden sm:table-header-group">
          <tr class="border-b border-slate-200 dark:border-slate-700">
            <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
              >Name</th
            >
            <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
              >Expected per pay</th
            >
            <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
              >Cadence</th
            >
            <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
              >Tax withheld</th
            >
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody class="block sm:table-row-group">
          {#each visibleSources as source (source.id)}
            {#if editingId === source.id}
              <tr
                class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
              >
                <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                  <input
                    type="text"
                    bind:value={editName}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-32 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="primary"
                      disabled={savingEdit}
                      label="Save {source.name}"
                      path={mdiContentSave}
                      onclick={() => saveEdit(source)}
                    />
                    <IconActionButton
                      variant="cancel"
                      label="Cancel editing {source.name}"
                      path={mdiCloseThick}
                      onclick={cancelEdit}
                    />
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Expected per pay</span
                  >
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={editExpectedAmount}
                    class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </td>
                <td class="block px-3 py-2 sm:table-cell">
                  <span
                    class="mb-1 block text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Cadence</span
                  >
                  <div class="flex flex-col gap-1">
                    <select
                      bind:value={editFrequency}
                      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {#each FREQUENCIES as f (f.value)}
                        <option value={f.value}>{f.label}</option>
                      {/each}
                    </select>
                    {#if editFrequency === 'monthly'}
                      <div class="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Day"
                          bind:value={editPayDayOfMonth}
                          class="w-16 rounded-md border border-slate-300 px-1 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <label
                          class="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                        >
                          <input
                            type="checkbox"
                            bind:checked={editWeekendRollback}
                            class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                          />
                          Roll to Fri
                        </label>
                      </div>
                    {:else}
                      <input
                        type="date"
                        bind:value={editAnchorDate}
                        class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    {/if}
                  </div>
                </td>
                <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Tax withheld</span
                  >
                  <input
                    type="checkbox"
                    bind:checked={editTaxWithheld}
                    class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                  />
                </td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="primary"
                    disabled={savingEdit}
                    label="Save {source.name}"
                    path={mdiContentSave}
                    onclick={() => saveEdit(source)}
                  />
                  <IconActionButton
                    variant="cancel"
                    label="Cancel editing {source.name}"
                    path={mdiCloseThick}
                    onclick={cancelEdit}
                  />
                </td>
              </tr>
            {:else}
              <tr
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
              >
                <td
                  class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
                >
                  <span class="min-w-0 truncate">{source.name}</span>
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {source.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(source)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {source.name}"
                      path={mdiDelete}
                      onclick={() => handleDelete(source)}
                    />
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Expected per pay</span
                  >
                  {formatCurrency(source.expectedAmount)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Cadence</span
                  >
                  {cadenceLabel(source)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Tax withheld</span
                  >
                  {source.taxWithheld ? 'Yes' : 'No'}
                </td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="neutral"
                    label="Edit {source.name}"
                    path={mdiPencil}
                    onclick={() => startEdit(source)}
                  />
                  <IconActionButton
                    variant="danger"
                    label="Delete {source.name}"
                    path={mdiDelete}
                    onclick={() => handleDelete(source)}
                  />
                </td>
              </tr>
            {/if}
          {:else}
            <tr class="block sm:table-row">
              <td
                colspan="5"
                class="block px-3 py-6 text-center text-sm text-slate-400 sm:table-cell dark:text-slate-500"
              >
                No income sources yet.
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card>

    <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Income entries</h2>
        <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {financialYearLabel(selectedFinancialYear)} to date:
          <span class="font-medium text-slate-900 dark:text-slate-100"
            >{formatCurrency(ytdSummary.total)}</span
          >
          <span class="mx-1 text-slate-300 dark:text-slate-600">·</span>
          Salary {formatCurrency(ytdSummary.salary)}
          <span class="mx-1 text-slate-300 dark:text-slate-600">·</span>
          Other {formatCurrency(ytdSummary.other)}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={() => changeYear(-1)}
          class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ← Prev
        </button>
        <span class="w-28 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
          {financialYearLabel(selectedFinancialYear)}
        </span>
        <button
          type="button"
          onclick={() => changeYear(1)}
          disabled={selectedFinancialYear >= currentFinancialYear()}
          class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Next →
        </button>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-2">
        {#each FILTERS as tab (tab.value)}
          <button
            type="button"
            onclick={() => (filter = tab.value)}
            class={[
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              filter === tab.value
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600',
            ]}
          >
            {tab.label}
            <span class="ml-1 text-xs font-normal opacity-70">{filterCount(tab.value)}</span>
          </button>
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-3">
        {#if filter !== 'salary'}
          <div class="flex items-center gap-2">
            <label
              class="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Marginal rate
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                bind:value={marginalRatePercent}
                class="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <PrimaryButton size="sm" onclick={saveMarginalRate} disabled={savingMarginalRate}>
              {savingMarginalRate ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </div>
        {/if}
        <ActionMenu
          label="Add income"
          actions={[
            { label: 'Salary', path: mdiBriefcase, onclick: toggleAddSalary },
            { label: 'Other income', path: mdiBank, onclick: toggleAddOther },
          ]}
        >
          {#snippet trigger(open, toggle)}
            <button
              type="button"
              onclick={toggle}
              aria-haspopup="true"
              aria-expanded={open}
              class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
                <path d={mdiPlus} />
              </svg>
              Add
              <svg viewBox="0 0 24 24" class="size-4" fill="currentColor" aria-hidden="true">
                <path d={mdiChevronDown} />
              </svg>
            </button>
          {/snippet}
        </ActionMenu>
      </div>
    </div>

    {#if filter !== 'salary' && savedMarginalRate === null}
      <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
        No marginal rate set for {financialYearLabel(selectedFinancialYear)} yet - Tax/Gain will show
        as "—" until one is saved.
      </p>
    {/if}

    {#if showAddSalary}
      <div
        class="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
      >
        <IncomeEntryForm
          sources={visibleSources}
          submitting={loggingEntry}
          onSubmit={handleAddSalary}
          submitOnOwnLine
          defaultReceivedOnToday
        >
          {#snippet footerActions()}
            <SecondaryButton type="button" onclick={() => (showAddSalary = false)}
              >Cancel</SecondaryButton
            >
          {/snippet}
        </IncomeEntryForm>
      </div>
    {/if}

    {#if showAddOther}
      <form
        onsubmit={handleAddItem}
        class="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
      >
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Date</span>
            <input
              type="date"
              bind:value={itemDate}
              class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Sale amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              bind:value={itemAmount}
              class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Item</span>
            <input
              type="text"
              placeholder="e.g. Share sale, dividend, bonus"
              bind:value={itemName}
              class="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label
            class="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500 dark:text-slate-400"
          >
            <input
              type="checkbox"
              bind:checked={itemTaxWithheld}
              class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
            />
            Tax withheld
          </label>
        </div>
        <div class="mt-3 flex items-center gap-3">
          <PrimaryButton type="submit" disabled={addingItem}>
            {addingItem ? 'Adding…' : 'Add item'}
          </PrimaryButton>
          <SecondaryButton type="button" onclick={() => (showAddOther = false)}
            >Cancel</SecondaryButton
          >
        </div>
      </form>
    {/if}

    {#if entriesLoading && !entriesLoaded}
      <LoadingIndicator class="mt-3" />
    {:else}
      <Card class="mt-3 sm:overflow-x-auto" pivotTable>
        <table class="block w-full border-collapse text-sm sm:table">
          <thead class="hidden sm:table-header-group">
            <tr class="border-b border-slate-200 dark:border-slate-700">
              <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
                >Item</th
              >
              <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
                >Date</th
              >
              <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                >Amount</th
              >
              <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
                >Tax withheld</th
              >
              <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                >Tax</th
              >
              <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                >Gain</th
              >
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody class="block sm:table-row-group">
            {#each visibleEntries as entry (entry.id)}
              {#if entry.incomeSourceId !== null}
                {#if editingEntryId === entry.id}
                  <tr
                    class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
                  >
                    <td class="block px-3 py-2 sm:table-cell">
                      <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                          <span class="block truncate text-slate-500 dark:text-slate-400"
                            >{sourceName(entry.incomeSourceId)}</span
                          >
                          <input
                            type="text"
                            placeholder="Note (optional)"
                            bind:value={editEntryNote}
                            class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <span class="flex shrink-0 items-center gap-1 sm:hidden">
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
                        </span>
                      </div>
                    </td>
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
                      class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Amount</span
                      >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        bind:value={editEntryAmount}
                        class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell dark:text-slate-500"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Tax withheld</span
                      >
                      {sourceById.get(entry.incomeSourceId)?.taxWithheld ? 'Yes' : 'No'}
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Tax</span
                      >
                      —
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Gain</span
                      >
                      —
                    </td>
                    <td
                      class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
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
                    class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
                  >
                    <td
                      class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
                    >
                      <div class="min-w-0">
                        <div class="truncate">{sourceName(entry.incomeSourceId)}</div>
                        {#if entry.note}
                          <div
                            class="mt-0.5 truncate text-xs font-normal text-slate-400 dark:text-slate-500"
                          >
                            {entry.note}
                          </div>
                        {/if}
                      </div>
                      <span class="flex shrink-0 items-center gap-1 sm:hidden">
                        <IconActionButton
                          variant="neutral"
                          label="Edit entry from {formatDate(entry.receivedOn)}"
                          path={mdiPencil}
                          onclick={() => startEditEntry(entry)}
                        />
                        <IconActionButton
                          variant="danger"
                          label="Delete entry from {formatDate(entry.receivedOn)}"
                          path={mdiDelete}
                          onclick={() => handleDeleteEntry(entry)}
                        />
                      </span>
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Date</span
                      >
                      {formatDate(entry.receivedOn)}
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Amount</span
                      >
                      {formatCurrency(entry.amount)}
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Tax withheld</span
                      >
                      {sourceById.get(entry.incomeSourceId)?.taxWithheld ? 'Yes' : 'No'}
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Tax</span
                      >
                      —
                    </td>
                    <td
                      class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                    >
                      <span
                        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                        >Gain</span
                      >
                      —
                    </td>
                    <td
                      class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                    >
                      <IconActionButton
                        variant="neutral"
                        label="Edit entry from {formatDate(entry.receivedOn)}"
                        path={mdiPencil}
                        onclick={() => startEditEntry(entry)}
                      />
                      <IconActionButton
                        variant="danger"
                        label="Delete entry from {formatDate(entry.receivedOn)}"
                        path={mdiDelete}
                        onclick={() => handleDeleteEntry(entry)}
                      />
                    </td>
                  </tr>
                {/if}
              {:else if editingItemId === entry.id}
                <tr
                  class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
                >
                  <td class="block px-3 py-2 sm:table-cell">
                    <div class="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        bind:value={editItemName}
                        class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <span class="flex shrink-0 items-center gap-1 sm:hidden">
                        <IconActionButton
                          variant="primary"
                          disabled={savingItemEdit}
                          label="Save entry from {formatDate(entry.receivedOn)}"
                          path={mdiContentSave}
                          onclick={() => saveItemEdit(entry)}
                        />
                        <IconActionButton
                          variant="cancel"
                          label="Cancel editing entry from {formatDate(entry.receivedOn)}"
                          path={mdiCloseThick}
                          onclick={cancelEditItem}
                        />
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2 sm:table-cell">
                    <input
                      type="date"
                      bind:value={editItemDate}
                      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Amount</span
                    >
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      bind:value={editItemAmount}
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Tax withheld</span
                    >
                    <input
                      type="checkbox"
                      bind:checked={editItemTaxWithheld}
                      class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                    />
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Tax</span
                    >
                    —
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-400 sm:table-cell sm:text-right dark:text-slate-500"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Gain</span
                    >
                    —
                  </td>
                  <td
                    class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="primary"
                      disabled={savingItemEdit}
                      label="Save entry from {formatDate(entry.receivedOn)}"
                      path={mdiContentSave}
                      onclick={() => saveItemEdit(entry)}
                    />
                    <IconActionButton
                      variant="cancel"
                      label="Cancel editing entry from {formatDate(entry.receivedOn)}"
                      path={mdiCloseThick}
                      onclick={cancelEditItem}
                    />
                  </td>
                </tr>
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
                >
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
                  >
                    <span class="min-w-0 truncate">{entry.note ?? '—'}</span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
                      <IconActionButton
                        variant="neutral"
                        label="Edit entry from {formatDate(entry.receivedOn)}"
                        path={mdiPencil}
                        onclick={() => startEditItem(entry)}
                      />
                      <IconActionButton
                        variant="danger"
                        label="Delete entry from {formatDate(entry.receivedOn)}"
                        path={mdiDelete}
                        onclick={() => handleDeleteItem(entry)}
                      />
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Date</span
                    >
                    {formatDate(entry.receivedOn)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Amount</span
                    >
                    {formatCurrency(entry.amount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Tax withheld</span
                    >
                    {entry.taxWithheld ? 'Yes' : 'No'}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Tax</span
                    >
                    {formatCurrency(computeItemTax(entry))}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Gain</span
                    >
                    {formatCurrency(computeItemGain(entry))}
                  </td>
                  <td
                    class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="neutral"
                      label="Edit entry from {formatDate(entry.receivedOn)}"
                      path={mdiPencil}
                      onclick={() => startEditItem(entry)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete entry from {formatDate(entry.receivedOn)}"
                      path={mdiDelete}
                      onclick={() => handleDeleteItem(entry)}
                    />
                  </td>
                </tr>
              {/if}
            {:else}
              <tr class="block sm:table-row">
                <td
                  colspan="7"
                  class="block px-3 py-6 text-center text-sm text-slate-400 sm:table-cell dark:text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
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
                  >Amount</span
                >
                {formatCurrency(visibleTotals.amount)}
              </td>
              <td class="hidden px-3 py-2 sm:table-cell"></td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Tax</span
                >
                {visibleHasOther ? formatCurrency(visibleTotals.tax) : '—'}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Gain</span
                >
                {visibleHasOther ? formatCurrency(visibleTotals.gain) : '—'}
              </td>
              <td class="hidden px-3 py-2 sm:table-cell"></td>
            </tr>
          </tfoot>
        </table>
      </Card>
    {/if}

    <Card class="mt-3 p-4">
      <button
        type="button"
        onclick={() => (showCharts = !showCharts)}
        aria-expanded={showCharts}
        class="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span class="block text-base font-semibold text-slate-900 dark:text-slate-100"
            >Charts</span
          >
          <span class="block text-sm text-slate-500 dark:text-slate-400">
            Estimated vs actual, year-by-year income, and how income splits between people and
            sources
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          class={[
            'size-5 shrink-0 text-slate-400 transition-transform',
            showCharts && 'rotate-180',
          ]}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d={mdiChevronDown} />
        </svg>
      </button>

      {#if showCharts}
        <div class="mt-4">
          {#if chartsLoading && allEntries.length === 0}
            <LoadingIndicator />
          {:else if chartError}
            <ErrorMessage message={chartError} />
          {:else}
            <div class="grid gap-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <section class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Income by person
                  </h3>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Net income by household member · {financialYearLabel(selectedFinancialYear)}
                  </p>
                  <div class="mt-3">
                    <PieChart
                      data={personPie}
                      emptyMessage="No income logged this year"
                      centerLabel="Net income"
                    />
                  </div>
                </section>

                <section class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Salary vs other income
                  </h3>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Net income by source type · {financialYearLabel(selectedFinancialYear)}
                  </p>
                  <div class="mt-3">
                    <PieChart
                      data={salaryVsOtherPie}
                      emptyMessage="No income logged this year"
                      centerLabel="Net income"
                    />
                  </div>
                </section>
              </div>

              <section class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Estimated vs actual income
                </h3>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {selectedUserLabel} · {financialYearLabel(selectedFinancialYear)}. Estimated is
                  what sources should have paid so far; actual is what's been logged.
                </p>
                <div class="mt-3">
                  <IncomeYtdChart data={ytdChartData} />
                </div>
              </section>

              <section class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Year by year
                </h3>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Cumulative net income for the household across each financial year.
                </p>
                <div class="mt-3">
                  <YearlyIncomeLineChart series={yearlySeries} />
                </div>
              </section>
            </div>
          {/if}
        </div>
      {/if}
    </Card>
  {/if}
{/if}
