<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listIncomeSources,
    createIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    getIncomeSourcesSummary,
    getIncomeYtd,
    listIncomeEntries,
    createIncomeEntry,
    updateIncomeEntry,
    deleteIncomeEntry,
    type IncomeSource,
    type IncomeSourceFrequency,
    type IncomeSourceSummary,
    type IncomeYtd,
    type IncomeEntry,
  } from '$lib/api/income'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { formatCurrency, formatDate, monthName } from '$lib/format'
  import { ApiError } from '$lib/api'

  const FREQUENCIES: { value: IncomeSourceFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'fortnightly', label: 'Fortnightly' },
  ]

  const currentYear = new Date().getFullYear()

  let users = $state<UserSummary[]>([])
  let sources = $state<IncomeSource[]>([])
  let summaries = $state<IncomeSourceSummary[]>([])
  let selectedUserId = $state<number | null>(null)
  let selectedYear = $state(currentYear)
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
  let monthEntries = $state<IncomeEntry[]>([])
  let entriesLoading = $state(false)

  let entrySourceId = $state('')
  let entryAmount = $state<number>(NaN)
  let entryReceivedOn = $state('')
  let entryNote = $state('')
  let loggingEntry = $state(false)

  let editingEntryId = $state<number | null>(null)
  let editEntryAmount = $state<number>(NaN)
  let editEntryReceivedOn = $state('')
  let editEntryNote = $state('')
  let savingEntryEdit = $state(false)

  const visibleSources = $derived(sources.filter((s) => s.userId === selectedUserId))

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      await refresh()
    } finally {
      loading = false
    }
    await loadYtd()
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

  async function loadYtd() {
    if (selectedUserId === null) return
    ytdLoading = true
    try {
      ytd = await getIncomeYtd(selectedUserId, selectedYear)
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load year-to-date income'
    } finally {
      ytdLoading = false
    }
  }

  function selectUser(userId: number) {
    selectedUserId = userId
    expandedMonth = null
    void loadYtd()
  }

  function changeYear(delta: number) {
    selectedYear += delta
    expandedMonth = null
    void loadYtd()
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
    if (selectedUserId === null || !name.trim() || Number.isNaN(expectedAmount)) {
      error = 'Name and expected amount are required'
      return
    }
    if (frequency === 'monthly' && Number.isNaN(payDayOfMonth)) {
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
    if (!editName.trim() || Number.isNaN(editExpectedAmount)) {
      error = 'Name and expected amount are required'
      return
    }
    if (editFrequency === 'monthly' && Number.isNaN(editPayDayOfMonth)) {
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
  async function loadMonthEntries(month: number) {
    entriesLoading = true
    try {
      const monthEntryList = await listIncomeEntries(selectedYear, month)
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

  function toggleMonth(month: number) {
    editingEntryId = null
    if (expandedMonth === month) {
      expandedMonth = null
      return
    }
    expandedMonth = month
    entrySourceId = visibleSources[0]?.id !== undefined ? String(visibleSources[0].id) : ''
    entryAmount = NaN
    entryReceivedOn = ''
    entryNote = ''
    void loadMonthEntries(month)
  }

  async function refreshEntries() {
    if (expandedMonth === null) return
    await Promise.all([loadMonthEntries(expandedMonth), loadYtd()])
  }

  async function handleAddEntry(event: SubmitEvent) {
    event.preventDefault()
    if (
      expandedMonth === null ||
      entrySourceId === '' ||
      Number.isNaN(entryAmount) ||
      entryAmount === null
    ) {
      error = 'Source and amount are required'
      return
    }
    loggingEntry = true
    error = null
    try {
      await createIncomeEntry({
        incomeSourceId: Number(entrySourceId),
        year: selectedYear,
        month: expandedMonth,
        amount: entryAmount,
        receivedOn: entryReceivedOn === '' ? null : entryReceivedOn,
        note: entryNote.trim() === '' ? null : entryNote.trim(),
      })
      entryAmount = NaN
      entryReceivedOn = ''
      entryNote = ''
      await refreshEntries()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to log income'
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
</script>

<svelte:head>
  <title>Income · Bookkeeper</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Income</h1>
<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
  Manage income sources and how often they're actually paid. Logging what came in each month still
  happens on the <a href="/month" class="text-indigo-600 hover:underline dark:text-indigo-400"
    >Monthly</a
  > page.
</p>

{#if error}
  <p class="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
{/if}

{#if loading}
  <p class="mt-6 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
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
    <div
      class="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
      <table class="w-full border-collapse text-sm">
        <thead>
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
        <tbody>
          {#each visibleSources as source (source.id)}
            {#if editingId === source.id}
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
                <td class="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={editExpectedAmount}
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
                          <input type="checkbox" bind:checked={editWeekendRollback} />
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
                <td class="px-3 py-2">
                  <input type="checkbox" bind:checked={editTaxWithheld} />
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => saveEdit(source)}
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
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                  {source.name}
                </td>
                <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(source.expectedAmount)}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {cadenceLabel(source)}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {source.taxWithheld ? 'Yes' : 'No'}
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => startEdit(source)}
                    class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onclick={() => handleDelete(source)}
                    class="ml-2 text-xs text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            {/if}
          {:else}
            <tr>
              <td
                colspan="5"
                class="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                No income sources yet.
              </td>
            </tr>
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
          <input type="checkbox" bind:checked={weekendRollback} />
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
        <input type="checkbox" bind:checked={taxWithheld} />
        Tax withheld (PAYG)
      </label>
      <button
        type="submit"
        disabled={creating}
        class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {creating ? 'Adding…' : 'Add income source'}
      </button>
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
        <span class="w-16 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
          {selectedYear}
        </span>
        <button
          type="button"
          onclick={() => changeYear(1)}
          disabled={selectedYear >= currentYear}
          class="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Next →
        </button>
      </div>
    </div>

    {#if ytdLoading}
      <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
    {:else if ytd && ytd.months.length > 0}
      {@const runningTotals = ytd.months.reduce<number[]>((acc, m) => {
        acc.push((acc.at(-1) ?? 0) + m.total)
        return acc
      }, [])}
      <div
        class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
      >
        <table class="w-full border-collapse text-sm">
          <thead>
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
          <tbody>
            {#each ytd.months as monthRow, i (monthRow.month)}
              {@const expanded = expandedMonth === monthRow.month}
              <tr
                class={[
                  'border-b border-slate-100 last:border-0 dark:border-slate-700/60',
                  expanded && 'bg-slate-100 dark:bg-slate-900/50',
                ]}
              >
                <td class="px-3 py-2 text-slate-900 dark:text-slate-100">
                  <button
                    type="button"
                    onclick={() => toggleMonth(monthRow.month)}
                    class="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    <span class="text-slate-400 dark:text-slate-500" aria-hidden="true"
                      >{expanded ? '▾' : '▸'}</span
                    >
                    {monthName(monthRow.month)}
                  </button>
                </td>
                {#each ytd.sources as source (source.id)}
                  <td class="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                    {formatCurrency(monthRow.bySource[source.id] ?? 0)}
                  </td>
                {/each}
                <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(monthRow.total)}
                  {#if monthRow.estimated}
                    <span
                      class="ml-1 text-xs font-normal text-slate-400 dark:text-slate-500"
                      title="No entry logged this month - backfilled from the projected amount"
                      >(est.)</span
                    >
                  {/if}
                </td>
                <td class="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                  {formatCurrency(runningTotals[i]!)}
                </td>
              </tr>
              {#if expanded}
                <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                  <td
                    colspan={ytd.sources.length + 3}
                    class="bg-slate-50 px-3 py-3 dark:bg-slate-900/25"
                  >
                    {#if entriesLoading}
                      <p class="text-xs text-slate-400 dark:text-slate-500">Loading entries…</p>
                    {:else}
                      <table class="w-full border-collapse text-sm">
                        <thead>
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
                        <tbody>
                          {#each monthEntries as entry (entry.id)}
                            {#if editingEntryId === entry.id}
                              <tr
                                class="border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20"
                              >
                                <td class="py-1.5 pr-3 text-slate-700 dark:text-slate-300">
                                  {sourceName(entry.incomeSourceId)}
                                </td>
                                <td class="py-1.5 pr-3 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    bind:value={editEntryAmount}
                                    class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </td>
                                <td class="py-1.5 pr-3">
                                  <input
                                    type="date"
                                    bind:value={editEntryReceivedOn}
                                    class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </td>
                                <td class="py-1.5 pr-3">
                                  <input
                                    type="text"
                                    bind:value={editEntryNote}
                                    class="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                </td>
                                <td class="py-1.5 text-right whitespace-nowrap">
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
                              <tr
                                class="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                              >
                                <td class="py-1.5 pr-3 text-slate-700 dark:text-slate-300">
                                  {sourceName(entry.incomeSourceId)}
                                </td>
                                <td
                                  class="py-1.5 pr-3 text-right text-slate-900 dark:text-slate-100"
                                >
                                  {formatCurrency(entry.amount)}
                                </td>
                                <td class="py-1.5 pr-3 text-slate-500 dark:text-slate-400">
                                  {formatDate(entry.receivedOn)}
                                </td>
                                <td class="py-1.5 pr-3 text-slate-500 dark:text-slate-400"
                                  >{entry.note ?? '—'}</td
                                >
                                <td class="py-1.5 text-right whitespace-nowrap">
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
                          {:else}
                            <tr>
                              <td
                                colspan="5"
                                class="py-3 text-center text-xs text-slate-400 dark:text-slate-500"
                              >
                                No entries logged for {monthName(monthRow.month)}.
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                      <form onsubmit={handleAddEntry} class="mt-3 flex flex-wrap items-end gap-3">
                        <label class="flex flex-col gap-1">
                          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
                            >Source</span
                          >
                          <select
                            bind:value={entrySourceId}
                            class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {#each visibleSources as source (source.id)}
                              <option value={source.id}>{source.name}</option>
                            {/each}
                          </select>
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
                            >Amount</span
                          >
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            bind:value={entryAmount}
                            class="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
                            >Received on</span
                          >
                          <input
                            type="date"
                            bind:value={entryReceivedOn}
                            class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>
                        <label class="flex flex-col gap-1">
                          <span class="text-xs font-medium text-slate-500 dark:text-slate-400"
                            >Note</span
                          >
                          <input
                            type="text"
                            placeholder="optional"
                            bind:value={entryNote}
                            class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={loggingEntry || visibleSources.length === 0}
                          class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                        >
                          {loggingEntry ? 'Logging…' : 'Log income'}
                        </button>
                      </form>
                    {/if}
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-200 font-semibold dark:border-slate-700">
              <td
                class="px-3 py-2 text-slate-900 dark:text-slate-100"
                colspan={1 + ytd.sources.length}>Year to date</td
              >
              <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100" colspan="2"
                >{formatCurrency(ytd.ytdTotal)}</td
              >
            </tr>
          </tfoot>
        </table>
      </div>
    {:else}
      <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">
        No data yet for {selectedYear}.
      </p>
    {/if}
  {/if}
{/if}
