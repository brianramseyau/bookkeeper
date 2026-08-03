<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import {
    listIncomeSources,
    createIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    getIncomeSourcesSummary,
    getIncomeYtd,
    listIncomeEntries,
    listIncomeEntriesForFinancialYear,
    createIncomeEntry,
    updateIncomeEntry,
    deleteIncomeEntry,
    type IncomeSource,
    type IncomeSourceFrequency,
    type IncomeSourceSummary,
    type IncomeYtd,
    type IncomeEntry,
  } from '$lib/api/income'
  import { getIncomeTaxSetting, setIncomeTaxSetting } from '$lib/api/income_tax_settings'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import {
    currentFinancialYear,
    financialYearLabel,
    formatCurrency,
    formatDate,
    monthYearLabel,
    round2,
  } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave, mdiDelete } from '@mdi/js'
  import IncomeEntryForm, {
    type IncomeEntryFormValues,
  } from '$lib/components/IncomeEntryForm.svelte'
  import IncomeEntryEditRow, {
    type IncomeEntryEditUpdates,
  } from '$lib/components/IncomeEntryEditRow.svelte'
  import IncomeEntryDisplayRow from '$lib/components/IncomeEntryDisplayRow.svelte'

  const FREQUENCIES: { value: IncomeSourceFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'fortnightly', label: 'Fortnightly' },
  ]

  let users = $state<UserSummary[]>([])
  let sources = $state<IncomeSource[]>([])
  let summaries = $state<IncomeSourceSummary[]>([])
  let selectedUserId = $state<number | null>(null)
  let selectedFinancialYear = $state(currentFinancialYear())
  let ytd = $state<IncomeYtd | null>(null)
  let ytdLoading = $state(false)
  let loading = $state(true)
  let error = $state<string | null>(null)

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

  let expandedMonth = $state<number | null>(null)
  let expandedYear = $state<number | null>(null)
  let monthEntries = $state<IncomeEntry[]>([])
  let entriesLoading = $state(false)
  let loggingEntry = $state(false)

  let editingEntryId = $state<number | null>(null)
  let savingEntryEdit = $state(false)

  let nonPaygItems = $state<IncomeEntry[]>([])
  let nonPaygLoading = $state(false)
  let nonPaygLoaded = $state(false)
  let savedMarginalRate = $state<number | null>(null)
  let marginalRatePercent = $state<number>(NaN)
  let savingMarginalRate = $state(false)

  let itemDate = $state('')
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

  const visibleSources = $derived(sources.filter((s) => s.userId === selectedUserId))

  const nonPaygTotals = $derived.by(() => {
    let sale = 0
    let tax = 0
    let gain = 0
    for (const item of nonPaygItems) {
      sale += item.amount
      if (!item.taxWithheld && savedMarginalRate !== null) {
        const itemTax = round2(item.amount * savedMarginalRate)
        tax += itemTax
        gain += round2(item.amount - itemTax)
      }
    }
    return { sale: round2(sale), tax: round2(tax), gain: round2(gain) }
  })

  function computeItemTax(item: IncomeEntry): number | null {
    if (item.taxWithheld || savedMarginalRate === null) return null
    return round2(item.amount * savedMarginalRate)
  }

  function computeItemGain(item: IncomeEntry): number | null {
    const tax = computeItemTax(item)
    return tax === null ? null : round2(item.amount - tax)
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
    await Promise.all([loadYtd(), loadNonPaygSection()])
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
        selectedUserId = users[0]!.id
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load income sources'
    }
  }

  // Only shows the section's loading state the first time it loads for a
  // given user - once there's data on screen, switching year should
  // re-fetch quietly rather than tearing the table down to a spinner and
  // back on every Prev/Next click.
  async function loadYtd() {
    if (selectedUserId === null) return
    if (!ytd) ytdLoading = true
    try {
      ytd = await getIncomeYtd(selectedUserId, selectedFinancialYear)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load year-to-date income'
    } finally {
      ytdLoading = false
    }
  }

  async function loadNonPaygSection() {
    if (selectedUserId === null) return
    if (!nonPaygLoaded) nonPaygLoading = true
    try {
      const [entries, setting] = await Promise.all([
        listIncomeEntriesForFinancialYear(selectedUserId, selectedFinancialYear),
        getIncomeTaxSetting(selectedUserId, selectedFinancialYear),
      ])
      nonPaygItems = entries
        .filter((entry) => entry.incomeSourceId === null)
        .sort((a, b) => (a.receivedOn ?? '').localeCompare(b.receivedOn ?? ''))
      savedMarginalRate = setting.marginalRate
      marginalRatePercent = setting.marginalRate === null ? NaN : round2(setting.marginalRate * 100)
      nonPaygLoaded = true
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load non-PAYG income'
    } finally {
      nonPaygLoading = false
    }
  }

  function selectUser(userId: number) {
    selectedUserId = userId
    expandedMonth = null
    editingItemId = null
    void loadYtd()
    void loadNonPaygSection()
  }

  function changeYear(delta: number) {
    selectedFinancialYear += delta
    expandedMonth = null
    editingItemId = null
    void loadYtd()
    void loadNonPaygSection()
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

  // Entries for a source-total cell aren't fetched until that month is
  // expanded - the YTD table already shows the aggregate, so there's no
  // need to pull every entry for the year up front.
  async function loadMonthEntries(year: number, month: number) {
    entriesLoading = true
    try {
      const monthEntryList = await listIncomeEntries(year, month)
      const visibleIds = new Set(visibleSources.map((s) => s.id))
      monthEntries = monthEntryList.filter(
        (entry) => entry.incomeSourceId !== null && visibleIds.has(entry.incomeSourceId)
      )
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load income entries'
    } finally {
      entriesLoading = false
    }
  }

  function toggleMonth(year: number, month: number) {
    editingEntryId = null
    if (expandedMonth === month) {
      expandedMonth = null
      expandedYear = null
      return
    }
    expandedMonth = month
    expandedYear = year
    void loadMonthEntries(year, month)
  }

  async function refreshEntries() {
    if (expandedMonth === null || expandedYear === null) return
    await Promise.all([loadMonthEntries(expandedYear, expandedMonth), loadYtd()])
  }

  async function handleAddEntry(values: IncomeEntryFormValues): Promise<boolean> {
    if (expandedMonth === null || expandedYear === null) return false
    if (values.incomeSourceId === null || Number.isNaN(values.amount) || values.amount === null) {
      error = 'Source and amount are required'
      return false
    }
    loggingEntry = true
    error = null
    try {
      await createIncomeEntry({
        incomeSourceId: values.incomeSourceId,
        year: expandedYear,
        month: expandedMonth,
        amount: values.amount,
        receivedOn: values.receivedOn,
        note: values.note,
      })
      await refreshEntries()
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
  }

  function cancelEditEntry() {
    editingEntryId = null
  }

  async function saveEntryEdit(entry: IncomeEntry, updates: IncomeEntryEditUpdates) {
    if (Number.isNaN(updates.amount) || updates.amount === null) {
      error = 'Amount is required'
      return
    }
    savingEntryEdit = true
    error = null
    try {
      await updateIncomeEntry(entry.id, updates)
      editingEntryId = null
      await refreshEntries()
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
      await refreshEntries()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete entry'
    }
  }

  function sourceName(sourceId: number | null): string {
    return sources.find((s) => s.id === sourceId)?.name ?? 'Unknown'
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

  function resetItemForm() {
    itemDate = ''
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
      await loadNonPaygSection()
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
      await loadNonPaygSection()
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
      await loadNonPaygSection()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete item'
    }
  }
</script>

<PageHead title="Income" />

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Manage income sources and how often they're actually paid. Logging what came in each month still
  happens on the <a href="/monthly" class="text-indigo-600 hover:underline dark:text-indigo-400"
    >Monthly</a
  > page.
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
    <Card class="mt-6 sm:overflow-x-auto">
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
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
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

    <form
      onsubmit={handleAdd}
      class="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
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
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Expected per pay</span>
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
        <label class="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500 dark:text-slate-400">
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

    <div class="mt-8 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Year to date</h2>
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

    {#if ytdLoading}
      <LoadingIndicator class="mt-3" />
    {:else if ytd && ytd.months.length > 0}
      {@const runningTotals = ytd.months.reduce<number[]>((acc, m) => {
        acc.push((acc.at(-1) ?? 0) + m.total)
        return acc
      }, [])}
      <Card class="mt-3 sm:overflow-x-auto">
        <table class="block w-full border-collapse text-sm sm:table">
          <thead class="hidden sm:table-header-group">
            <tr class="border-b border-slate-200 dark:border-slate-700">
              <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
                >Month</th
              >
              {#each ytd.sources as source (source.id)}
                <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                  >{source.name}</th
                >
              {/each}
              <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                >Total</th
              >
              <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                >YTD</th
              >
            </tr>
          </thead>
          <tbody class="block sm:table-row-group">
            {#each ytd.months as monthRow, i (monthRow.month)}
              {@const expanded = expandedMonth === monthRow.month}
              <tr
                class={[
                  'mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60',
                  expanded && 'bg-slate-100 dark:bg-slate-900/50',
                ]}
              >
                <td class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100">
                  <button
                    type="button"
                    onclick={() => toggleMonth(monthRow.year, monthRow.month)}
                    class="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <span class="text-slate-400 dark:text-slate-500" aria-hidden="true"
                      >{expanded ? '▾' : '▸'}</span
                    >
                    {monthYearLabel(monthRow.year, monthRow.month)}
                  </button>
                </td>
                {#each ytd.sources as source (source.id)}
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >{source.name}</span
                    >
                    {formatCurrency(monthRow.bySource[source.id] ?? 0)}
                  </td>
                {/each}
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Total</span
                  >
                  <span>
                    {formatCurrency(monthRow.total)}
                    {#if monthRow.estimated}
                      <span
                        class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500"
                        title="No entry logged this month - backfilled from the projected amount"
                        >(est.)</span
                      >
                    {/if}
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >YTD</span
                  >
                  {formatCurrency(runningTotals[i]!)}
                </td>
              </tr>
              {#if expanded}
                <tr
                  class="block border-b border-slate-100 last:border-0 sm:table-row dark:border-slate-700/60"
                >
                  <td
                    colspan={ytd.sources.length + 3}
                    class="block bg-slate-50 px-3 py-3 sm:table-cell dark:bg-slate-900/25"
                  >
                    {#if entriesLoading}
                      <p class="text-xs text-slate-400 dark:text-slate-500">Loading entries…</p>
                    {:else}
                      <table class="block w-full border-collapse text-sm sm:table">
                        <thead class="hidden sm:table-header-group">
                          <tr class="border-b border-slate-200 dark:border-slate-700">
                            <th
                              class="py-1.5 pr-3 text-left font-semibold text-slate-500 dark:text-slate-400"
                              >Source</th
                            >
                            <th
                              class="py-1.5 pr-3 text-right font-semibold text-slate-500 dark:text-slate-400"
                              >Amount</th
                            >
                            <th
                              class="py-1.5 pr-3 text-left font-semibold text-slate-500 dark:text-slate-400"
                              >Date</th
                            >
                            <th
                              class="py-1.5 pr-3 text-left font-semibold text-slate-500 dark:text-slate-400"
                              >Note</th
                            >
                            <th class="py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody class="block sm:table-row-group">
                          {#each monthEntries as entry (entry.id)}
                            {#snippet sourceCell(actions: Snippet)}
                              <td
                                class="flex min-h-9 items-center justify-between gap-3 py-1.5 pr-3 text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                              >
                                <span class="min-w-0 truncate"
                                  >{sourceName(entry.incomeSourceId)}</span
                                >
                                {@render actions()}
                              </td>
                            {/snippet}
                            {#if editingEntryId === entry.id}
                              <IncomeEntryEditRow
                                initialAmount={entry.amount}
                                initialReceivedOn={entry.receivedOn
                                  ? entry.receivedOn.slice(0, 10)
                                  : ''}
                                initialNote={entry.note ?? ''}
                                saving={savingEntryEdit}
                                cellClass="py-1.5 pr-3"
                                lastCellClass="py-1.5 text-right whitespace-nowrap"
                                leading={sourceCell}
                                onSave={(updates) => saveEntryEdit(entry, updates)}
                                onCancel={cancelEditEntry}
                              />
                            {:else}
                              <IncomeEntryDisplayRow
                                amount={entry.amount}
                                receivedOn={entry.receivedOn}
                                note={entry.note}
                                cellClass="py-1.5 pr-3"
                                lastCellClass="py-1.5 text-right whitespace-nowrap"
                                amountValueClass="text-slate-900 dark:text-slate-100"
                                leading={sourceCell}
                                onEdit={() => startEditEntry(entry)}
                                onRemove={() => handleDeleteEntry(entry)}
                              />
                            {/if}
                          {:else}
                            <tr class="block sm:table-row">
                              <td
                                colspan="5"
                                class="block py-3 text-center text-xs text-slate-400 sm:table-cell dark:text-slate-500"
                              >
                                No entries logged for {monthYearLabel(
                                  monthRow.year,
                                  monthRow.month
                                )}.
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                      <IncomeEntryForm
                        sources={visibleSources}
                        submitting={loggingEntry}
                        class="mt-3 flex flex-wrap items-end gap-3"
                        onSubmit={handleAddEntry}
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
              <td
                class="px-3 py-2 text-slate-900 sm:table-cell dark:text-slate-100"
                colspan={1 + ytd.sources.length}>Year to date</td
              >
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                colspan="2"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Total</span
                >
                {formatCurrency(ytd.ytdTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    {:else}
      <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">
        No data yet for {financialYearLabel(selectedFinancialYear)}.
      </p>
    {/if}

    <div class="mt-8 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Non-PAYG Income Tax</h2>
      <span class="text-sm text-slate-500 dark:text-slate-400">
        {financialYearLabel(selectedFinancialYear)}
      </span>
    </div>

    <div
      class="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
          >Marginal tax rate (%)</span
        >
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          bind:value={marginalRatePercent}
          class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <PrimaryButton onclick={saveMarginalRate} disabled={savingMarginalRate}>
        {savingMarginalRate ? 'Saving…' : 'Save rate'}
      </PrimaryButton>
      {#if savedMarginalRate === null}
        <span class="pb-1.5 text-xs text-slate-400 dark:text-slate-500">
          No rate set for {financialYearLabel(selectedFinancialYear)} yet - Tax/Gain will show as "—"
          until one is saved.
        </span>
      {/if}
    </div>

    {#if nonPaygLoading}
      <LoadingIndicator class="mt-3" />
    {:else}
      <Card class="mt-3 sm:overflow-x-auto">
        <table class="block w-full border-collapse text-sm sm:table">
          <thead class="hidden sm:table-header-group">
            <tr class="border-b border-slate-200 dark:border-slate-700">
              <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
                >Date</th
              >
              <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
                >Item</th
              >
              <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                >Sale</th
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
            {#each nonPaygItems as item (item.id)}
              {#if editingItemId === item.id}
                <tr
                  class="mb-2 block divide-y divide-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50/40 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-indigo-900/40 dark:border-indigo-900/40 dark:bg-indigo-900/20 sm:dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 sm:table-cell">
                    <input
                      type="date"
                      bind:value={editItemDate}
                      class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td class="block px-3 py-2 sm:table-cell">
                    <div class="mb-1 flex items-center justify-between gap-3 sm:hidden">
                      <span class="text-xs font-medium text-slate-400 uppercase dark:text-slate-500"
                        >Item</span
                      >
                      <span class="flex shrink-0 items-center gap-1">
                        <IconActionButton
                          variant="primary"
                          disabled={savingItemEdit}
                          label="Save entry from {formatDate(item.receivedOn)}"
                          path={mdiContentSave}
                          onclick={() => saveItemEdit(item)}
                        />
                        <IconActionButton
                          variant="cancel"
                          label="Cancel editing entry from {formatDate(item.receivedOn)}"
                          path={mdiCloseThick}
                          onclick={cancelEditItem}
                        />
                      </span>
                    </div>
                    <input
                      type="text"
                      bind:value={editItemName}
                      class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Sale</span
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
                      label="Save entry from {formatDate(item.receivedOn)}"
                      path={mdiContentSave}
                      onclick={() => saveItemEdit(item)}
                    />
                    <IconActionButton
                      variant="cancel"
                      label="Cancel editing entry from {formatDate(item.receivedOn)}"
                      path={mdiCloseThick}
                      onclick={cancelEditItem}
                    />
                  </td>
                </tr>
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400">
                    {formatDate(item.receivedOn)}
                  </td>
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
                  >
                    <span class="min-w-0 truncate">{item.note ?? '—'}</span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
                      <IconActionButton
                        variant="neutral"
                        label="Edit entry from {formatDate(item.receivedOn)}"
                        path={mdiPencil}
                        onclick={() => startEditItem(item)}
                      />
                      <IconActionButton
                        variant="danger"
                        label="Delete entry from {formatDate(item.receivedOn)}"
                        path={mdiDelete}
                        onclick={() => handleDeleteItem(item)}
                      />
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Sale</span
                    >
                    {formatCurrency(item.amount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Tax withheld</span
                    >
                    {item.taxWithheld ? 'Yes' : 'No'}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Tax</span
                    >
                    {formatCurrency(computeItemTax(item))}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Gain</span
                    >
                    {formatCurrency(computeItemGain(item))}
                  </td>
                  <td
                    class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="neutral"
                      label="Edit entry from {formatDate(item.receivedOn)}"
                      path={mdiPencil}
                      onclick={() => startEditItem(item)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete entry from {formatDate(item.receivedOn)}"
                      path={mdiDelete}
                      onclick={() => handleDeleteItem(item)}
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
                  No non-PAYG income logged for {financialYearLabel(selectedFinancialYear)}.
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
                  >Sale</span
                >
                {formatCurrency(nonPaygTotals.sale)}
              </td>
              <td class="hidden px-3 py-2 sm:table-cell"></td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Tax</span
                >
                {formatCurrency(nonPaygTotals.tax)}
              </td>
              <td
                class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
              >
                <span
                  class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                  >Gain</span
                >
                {formatCurrency(nonPaygTotals.gain)}
              </td>
              <td class="hidden px-3 py-2 sm:table-cell"></td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <form
        onsubmit={handleAddItem}
        class="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800"
      >
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Date</span>
          <input
            type="date"
            bind:value={itemDate}
            class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
        <label class="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            bind:checked={itemTaxWithheld}
            class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
          />
          Tax withheld
        </label>
        <PrimaryButton type="submit" disabled={addingItem}>
          {addingItem ? 'Adding…' : 'Add item'}
        </PrimaryButton>
      </form>
    {/if}
  {/if}
{/if}
