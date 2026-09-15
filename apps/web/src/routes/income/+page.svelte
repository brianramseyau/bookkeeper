<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listIncomeSources,
    createIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    getIncomeSourcesSummary,
    listAllIncomeEntriesForFinancialYear,
    createIncomeEntry,
    updateIncomeEntry,
    deleteIncomeEntry,
    type IncomeSource,
    type IncomeSourceSummary,
    type IncomeEntry,
  } from '$lib/api/income'
  import { getIncomeTaxSetting, setIncomeTaxSetting } from '$lib/api/income_tax_settings'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { authState } from '$lib/stores/auth.svelte'
  import {
    currentFinancialYear,
    financialYearLabel,
    formatCurrency,
    round2,
    todayISO,
  } from '$lib/format'
  import { entryRowLabel } from '$lib/income-rows'
  import { entryGain, sumEntryTotals } from '$lib/income-entries'
  import { ApiError } from '$lib/api'
  import { cn } from '$lib/utils'
  import { toast } from 'svelte-sonner'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import { Button } from '$lib/components/ui/button'
  import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import { mdiPlus, mdiChevronDown, mdiBriefcase, mdiBank } from '@mdi/js'
  import IncomeEntryEditRow, {
    type IncomeEntryEditTarget,
    type IncomeEntryEditValues,
  } from '$lib/components/IncomeEntryEditRow.svelte'
  import IncomeSourceFormSheet, {
    type IncomeSourceFormValues,
  } from '$lib/components/income/IncomeSourceFormSheet.svelte'
  import IncomeSourcesTable from '$lib/components/income/IncomeSourcesTable.svelte'
  import IncomeEntriesTable from '$lib/components/income/IncomeEntriesTable.svelte'
  import IncomeChartsSection from '$lib/components/income/IncomeChartsSection.svelte'

  type EntryFilter = 'all' | 'salary' | 'other'

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

  // Adding and editing a source both happen in IncomeSourceFormSheet - the
  // target is null when adding, the source being edited otherwise.
  let sourceFormOpen = $state(false)
  let sourceFormTarget = $state<IncomeSource | null>(null)
  let sourceFormSubmitting = $state(false)
  let sourceFormError = $state<string | null>(null)

  // The shared income-entry sheet, covering editing a salary entry, editing
  // an "other income" item, and adding either - see IncomeEntryEditRow.
  let entryEditOpen = $state(false)
  let entryEditTarget = $state<IncomeEntryEditTarget | null>(null)
  let entryEditSubmitting = $state(false)
  let entryEditError = $state<string | null>(null)

  let savedMarginalRate = $state<number | null>(null)
  let marginalRatePercent = $state<number>(NaN)
  let savingMarginalRate = $state(false)

  const visibleSources = $derived(sources.filter((s) => s.userId === selectedUserId))

  const salaryEntries = $derived(entries.filter((e) => e.incomeSourceId !== null))
  const otherEntries = $derived(entries.filter((e) => e.incomeSourceId === null))

  const visibleEntries = $derived.by(() => {
    const base = filter === 'all' ? entries : filter === 'salary' ? salaryEntries : otherEntries
    return [...base].sort((a, b) => (b.receivedOn ?? '').localeCompare(a.receivedOn ?? ''))
  })

  const visibleHasOther = $derived(visibleEntries.some((e) => e.incomeSourceId === null))

  const visibleTotals = $derived(sumEntryTotals(visibleEntries, savedMarginalRate))

  // Both figures are net (usable) income, so the total is a true budget
  // number: salary entries are already net take-home (PAYG withheld at the
  // source), and other income counts its post-marginal-rate gain - or its
  // full amount when tax was withheld at source, or (no rate set yet) the
  // gross sale as the only number available.
  const ytdSummary = $derived.by(() => {
    const salary = round2(salaryEntries.reduce((a, e) => a + e.amount, 0))
    const other = round2(
      otherEntries.reduce((a, e) => a + (entryGain(e, savedMarginalRate) ?? e.amount), 0)
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

  // Bumped after an entry mutation so IncomeChartsSection refetches while open.
  let chartsRefreshToken = $state(0)

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

  // Only one sheet is ever open (source add/edit, or entry add/edit), so
  // opening any of them closes the others.
  function closeSheets() {
    sourceFormOpen = false
    sourceFormTarget = null
    entryEditOpen = false
    entryEditTarget = null
  }

  function resetTransientState() {
    closeSheets()
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

  function openAddSource() {
    closeSheets()
    sourceFormTarget = null
    sourceFormError = null
    sourceFormOpen = true
  }

  function openEditSource(source: IncomeSource) {
    closeSheets()
    sourceFormTarget = source
    sourceFormError = null
    sourceFormOpen = true
  }

  async function saveSource(values: IncomeSourceFormValues) {
    const target = sourceFormTarget
    sourceFormSubmitting = true
    sourceFormError = null
    error = null
    try {
      if (target) {
        await updateIncomeSource(target.id, values)
      } else {
        if (selectedUserId === null) {
          sourceFormSubmitting = false
          return
        }
        // The create validator's cadence fields are `.optional()` but not
        // `.nullable()` (unlike update), so the field that doesn't apply must
        // be omitted entirely rather than sent as `null`.
        await createIncomeSource({
          userId: selectedUserId,
          ...values,
          payDayOfMonth: values.payDayOfMonth ?? undefined,
          anchorDate: values.anchorDate ?? undefined,
        })
      }
    } catch (err) {
      sourceFormError = err instanceof ApiError ? err.message : 'Failed to save income source'
      sourceFormSubmitting = false
      return
    }
    sourceFormOpen = false
    sourceFormTarget = null
    sourceFormSubmitting = false
    toast.success(target ? 'Income source saved' : 'Income source added')
    try {
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to reload income sources'
    }
  }

  async function handleDelete(source: IncomeSource) {
    const confirmed = await confirmDestructive({
      title: `Delete ${source.name}?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    error = null
    try {
      await deleteIncomeSource(source.id)
      sources = sources.filter((s) => s.id !== source.id)
      summaries = await getIncomeSourcesSummary()
      toast.success('Income source deleted')
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to remove'
    }
  }

  function openEditEntry(entry: IncomeEntry) {
    closeSheets()
    entryEditTarget = { type: 'entry', entry }
    entryEditError = null
    entryEditOpen = true
  }

  function openAddSalary() {
    if (selectedUserId === null) return
    closeSheets()
    entryEditTarget = {
      type: 'new',
      kind: 'salary',
      sources: visibleSources,
      userId: selectedUserId,
      receivedOn: todayISO(),
    }
    entryEditError = null
    entryEditOpen = true
  }

  function openAddOther() {
    if (selectedUserId === null) return
    closeSheets()
    entryEditTarget = {
      type: 'new',
      kind: 'other',
      sources: [],
      userId: selectedUserId,
      receivedOn: todayISO(),
    }
    entryEditError = null
    entryEditOpen = true
  }

  async function saveEntryEditValues(values: IncomeEntryEditValues) {
    const target = entryEditTarget
    if (!target) return
    if (Number.isNaN(values.amount) || values.amount === null) {
      entryEditError = 'Amount is required'
      return
    }
    const isNew = target.type === 'new'
    const isSalary =
      target.type === 'entry'
        ? target.entry.incomeSourceId !== null
        : isNew && target.kind === 'salary'
    // A brand-new salary entry needs a date and a source; "other income"
    // (new or edited) needs a date, a person and an item name. A salary
    // entry's note is always optional, and an older entry's date may be
    // missing.
    if (isNew && values.receivedOn === '') {
      entryEditError = 'Pick a date'
      return
    }
    if (
      isNew &&
      target.type === 'new' &&
      target.kind === 'salary' &&
      values.incomeSourceId === null
    ) {
      entryEditError = 'Pick a source'
      return
    }
    if (!isSalary) {
      if (values.receivedOn === '') {
        entryEditError = 'Pick a date'
        return
      }
      if (values.userId === null) {
        entryEditError = 'A person is required for other income'
        return
      }
      if (values.note.trim() === '') {
        entryEditError = 'Enter an item'
        return
      }
    }
    entryEditSubmitting = true
    entryEditError = null
    error = null
    try {
      if (target.type === 'entry') {
        const entry = target.entry
        const receivedOn = values.receivedOn === '' ? null : values.receivedOn
        // A received-on date determines the entry's financial year, so a
        // change to it re-stamps year/month - otherwise the row could be
        // filtered into the wrong year after an edit (the API leaves them
        // untouched).
        const [year, month] =
          receivedOn === null
            ? [undefined, undefined]
            : (receivedOn.split('-').map(Number) as [number, number])
        await updateIncomeEntry(entry.id, {
          year,
          month,
          userId: entry.incomeSourceId === null ? (values.userId ?? undefined) : undefined,
          amount: values.amount,
          receivedOn,
          note: values.note === '' ? null : values.note,
          taxWithheld: entry.incomeSourceId === null ? values.taxWithheld : undefined,
        })
        toast.success('Income entry saved')
      } else {
        const incomeSourceId =
          target.type === 'placeholder'
            ? target.sourceId
            : target.kind === 'salary'
              ? values.incomeSourceId
              : null
        const [year, month] = values.receivedOn.split('-').map(Number) as [number, number]
        await createIncomeEntry({
          incomeSourceId,
          userId: incomeSourceId === null ? (values.userId ?? undefined) : undefined,
          year,
          month,
          amount: values.amount,
          receivedOn: values.receivedOn,
          note: values.note === '' ? null : values.note,
          taxWithheld: incomeSourceId === null ? values.taxWithheld : undefined,
        })
        toast.success(target.type === 'placeholder' ? 'Income entry saved' : 'Income entry added')
      }
    } catch (err) {
      entryEditError = err instanceof ApiError ? err.message : 'Failed to save changes'
      entryEditSubmitting = false
      return
    }
    entryEditOpen = false
    entryEditTarget = null
    entryEditSubmitting = false
    // `loadEntries()` surfaces its own failure on the page banner, but only
    // while the sheet is closed - which it now is, so the user sees it.
    await loadEntries()
    chartsRefreshToken++
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
      await loadEntries()
      chartsRefreshToken++
      toast.success('Income entry deleted')
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete entry'
    }
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
      toast.success('Marginal tax rate saved')
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save marginal tax rate'
    } finally {
      savingMarginalRate = false
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
      <Button variant="outline" onclick={openAddSource}>Add source</Button>
    </div>

    <IncomeSourcesTable sources={visibleSources} onEdit={openEditSource} onDelete={handleDelete} />

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
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(value) => (filter = (value || 'all') as EntryFilter)}
        variant="outline"
        size="sm"
      >
        {#each FILTERS as tab (tab.value)}
          <ToggleGroupItem value={tab.value}>
            {tab.label}
            <span class="ml-1 text-xs font-normal opacity-70">{filterCount(tab.value)}</span>
          </ToggleGroupItem>
        {/each}
      </ToggleGroup>
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
            <Button size="sm" onclick={saveMarginalRate} disabled={savingMarginalRate}>
              {savingMarginalRate ? 'Saving…' : 'Save'}
            </Button>
          </div>
        {/if}
        <ActionMenu
          label="Add income"
          actions={[
            { label: 'Salary', path: mdiBriefcase, onclick: openAddSalary },
            { label: 'Other income', path: mdiBank, onclick: openAddOther },
          ]}
        >
          {#snippet trigger(triggerProps)}
            <button
              type="button"
              {...triggerProps}
              class={cn(
                'inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400',
                triggerProps.class as string | undefined
              )}
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

    {#if entriesLoading && !entriesLoaded}
      <LoadingIndicator class="mt-3" />
    {:else}
      <IncomeEntriesTable
        entries={visibleEntries}
        sources={visibleSources}
        marginalRate={savedMarginalRate}
        totals={visibleTotals}
        hasOther={visibleHasOther}
        {emptyMessage}
        onEdit={openEditEntry}
        onDelete={handleDeleteEntry}
      />
    {/if}

    <IncomeChartsSection
      userId={selectedUserId}
      financialYear={selectedFinancialYear}
      {users}
      {sources}
      refreshToken={chartsRefreshToken}
    />

    <IncomeSourceFormSheet
      open={sourceFormOpen}
      onOpenChange={(next) => {
        sourceFormOpen = next
        if (!next) sourceFormTarget = null
      }}
      source={sourceFormTarget}
      submitting={sourceFormSubmitting}
      error={sourceFormError}
      onSubmit={saveSource}
    />

    <IncomeEntryEditRow
      open={entryEditOpen}
      onOpenChange={(next) => {
        entryEditOpen = next
        if (!next) entryEditTarget = null
      }}
      target={entryEditTarget}
      {users}
      noteRequired
      submitting={entryEditSubmitting}
      error={entryEditError}
      onSave={saveEntryEditValues}
    />
  {/if}
{/if}
