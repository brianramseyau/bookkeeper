<script lang="ts">
  import { onMount, tick } from 'svelte'
  import {
    listUpcomingRecurringBills,
    createRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    type UpcomingRecurringBill,
    type RecurringBillFrequency,
  } from '$lib/api/recurring-bills'
  import { listCategories, type Category } from '$lib/api/categories'
  import { formatCurrency, formatDate, formatDaysUntilDue } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import CategorySelect from '$lib/components/CategorySelect.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import {
    mdiPencil,
    mdiCloseThick,
    mdiContentSave,
    mdiPause,
    mdiPlay,
    mdiArchive,
    mdiPackageUp,
    mdiDelete,
    mdiRestore,
  } from '@mdi/js'

  const FREQUENCIES: { value: RecurringBillFrequency; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'biannual', label: 'Biannual' },
    { value: 'annual', label: 'Annual' },
    { value: 'biennial', label: 'Every 2 years' },
    { value: 'triennial', label: 'Every 3 years' },
  ]

  let bills = $state<UpcomingRecurringBill[]>([])
  let categories = $state<Category[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showHidden = $state(false)

  const activeBills = $derived(
    bills.filter((bill) => bill.isActive && !bill.isPaused && !bill.isArchived)
  )
  const pausedBills = $derived(
    bills.filter((bill) => bill.isActive && bill.isPaused && !bill.isArchived)
  )
  const archivedBills = $derived(bills.filter((bill) => bill.isActive && bill.isArchived))
  const removedBills = $derived(bills.filter((bill) => !bill.isActive))

  const groupedBills = $derived(
    FREQUENCIES.map((f) => ({
      ...f,
      bills: activeBills.filter((bill) => bill.frequency === f.value),
    })).filter((group) => group.bills.length > 0)
  )

  let name = $state('')
  let amount = $state<number>(NaN)
  let frequency = $state<RecurringBillFrequency>('annual')
  let nextDueOn = $state('')
  let categoryId = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editAmount = $state<number>(NaN)
  let editFrequency = $state<RecurringBillFrequency>('annual')
  let editNextDueOn = $state('')
  let savingEdit = $state(false)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      await refresh()
    } finally {
      loading = false
    }

    // The per-bill anchors (e.g. #bill-12, linked from a bill's row on the
    // Monthly page) only exist once `bills` has loaded and rendered - the
    // browser's own load-time hash scroll runs too early to find them in
    // this client-rendered SPA, so it has to be redone by hand once the DOM
    // actually reflects the fetched data.
    if (window.location.hash) {
      await tick()
      const target = document.getElementById(window.location.hash.slice(1))
      target?.scrollIntoView()
      // Flash the landed-on row so it's easy to spot among the rest of the
      // list, same idea as Jira's flash when you follow a link to a comment.
      target?.classList.add('highlight-flash')
    }
  }

  // Re-fetches without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the table and
  // resets scroll position on every add/edit/pause/archive action.
  async function refresh() {
    try {
      const [billList, categoryList] = await Promise.all([
        listUpcomingRecurringBills({ includeHidden: true }),
        listCategories(),
      ])
      bills = billList
      categories = categoryList
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load recurring bills'
    }
  }

  function frequencyLabel(bill: UpcomingRecurringBill): string {
    return FREQUENCIES.find((f) => f.value === bill.frequency)?.label ?? bill.frequency
  }

  async function handleCategoryChange(bill: UpcomingRecurringBill, value: string) {
    error = null
    try {
      await updateRecurringBill(bill.id, {
        categoryId: value === '' ? null : Number(value),
      })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update category'
    }
  }

  async function handleDelete(bill: UpcomingRecurringBill) {
    if (!confirm(`Permanently delete "${bill.name}"? This cannot be undone.`)) return
    error = null
    try {
      await deleteRecurringBill(bill.id)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handlePause(bill: UpcomingRecurringBill) {
    error = null
    try {
      await updateRecurringBill(bill.id, { isPaused: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to pause'
    }
  }

  async function handleUnpause(bill: UpcomingRecurringBill) {
    error = null
    try {
      await updateRecurringBill(bill.id, { isPaused: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unpause'
    }
  }

  async function handleArchive(bill: UpcomingRecurringBill) {
    error = null
    try {
      await updateRecurringBill(bill.id, { isArchived: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to archive'
    }
  }

  async function handleUnarchive(bill: UpcomingRecurringBill) {
    error = null
    try {
      await updateRecurringBill(bill.id, { isArchived: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unarchive'
    }
  }

  async function handleRestore(bill: UpcomingRecurringBill) {
    error = null
    try {
      await updateRecurringBill(bill.id, { isActive: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to restore'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (!name.trim() || !nextDueOn || Number.isNaN(amount) || amount === null) {
      error = 'Name, amount, and next due date are required'
      return
    }
    creating = true
    error = null
    try {
      await createRecurringBill({
        name: name.trim(),
        amount,
        frequency,
        nextDueOn,
        categoryId: categoryId === '' ? undefined : Number(categoryId),
      })
      name = ''
      amount = NaN
      frequency = 'annual'
      nextDueOn = ''
      categoryId = ''
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add recurring bill'
    } finally {
      creating = false
    }
  }

  function startEdit(bill: UpcomingRecurringBill) {
    editingId = bill.id
    editName = bill.name
    editAmount = bill.amount
    editFrequency = bill.frequency
    editNextDueOn = bill.nextDueOn ? bill.nextDueOn.slice(0, 10) : ''
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(bill: UpcomingRecurringBill) {
    if (!editName.trim() || !editNextDueOn || Number.isNaN(editAmount) || editAmount === null) {
      error = 'Name, amount, and next due date are required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateRecurringBill(bill.id, {
        name: editName.trim(),
        amount: editAmount,
        frequency: editFrequency,
        nextDueOn: editNextDueOn,
      })
      editingId = null
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }
</script>

{#snippet editRow(bill: UpcomingRecurringBill)}
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
          label="Save {bill.name}"
          path={mdiContentSave}
          onclick={() => saveEdit(bill)}
        />
        <IconActionButton
          variant="cancel"
          label="Cancel editing {bill.name}"
          path={mdiCloseThick}
          onclick={cancelEdit}
        />
      </span>
    </td>
    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Category</span
      >
      <CategorySelect
        {categories}
        value={bill.categoryId}
        onchange={(value) => handleCategoryChange(bill, value)}
        variant="table"
      />
    </td>
    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right">
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Amount</span
      >
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={editAmount}
        class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </td>
    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Frequency</span
      >
      <select
        bind:value={editFrequency}
        class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        {#each FREQUENCIES as f (f.value)}
          <option value={f.value}>{f.label}</option>
        {/each}
      </select>
    </td>
    <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
      <span
        class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
        >Next due</span
      >
      <input
        type="date"
        bind:value={editNextDueOn}
        class="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </td>
    <td class="hidden px-3 py-2 sm:table-cell"></td>
    <td class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right">
      <IconActionButton
        variant="primary"
        disabled={savingEdit}
        label="Save {bill.name}"
        path={mdiContentSave}
        onclick={() => saveEdit(bill)}
      />
      <IconActionButton
        variant="cancel"
        label="Cancel editing {bill.name}"
        path={mdiCloseThick}
        onclick={cancelEdit}
      />
    </td>
  </tr>
{/snippet}

<PageHead title="Bills" />

<div class="flex items-center justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bills</h1>
  <button
    type="button"
    onclick={() => (showHidden = !showHidden)}
    class="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
  >
    {showHidden ? 'Hide' : 'Show'} paused / archived / removed
  </button>
</div>

{#if error}
  <ErrorMessage message={error} />
{/if}

{#if loading}
  <LoadingIndicator />
{:else}
  <Card class="mt-6 sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-b border-slate-200 dark:border-slate-700">
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Name</th>
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Category</th
          >
          <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
            >Amount</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Frequency</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
            >Next due</th
          >
          <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"></th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each groupedBills as group (group.value)}
          <tr
            id={group.value}
            class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
          >
            <td
              colspan="7"
              class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
            >
              {group.label}
            </td>
          </tr>
          {#each group.bills as bill (bill.id)}
            {#if editingId === bill.id}
              {@render editRow(bill)}
            {:else}
              <tr
                id="bill-{bill.id}"
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
              >
                <td
                  class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
                >
                  <span class="min-w-0 truncate">{bill.name}</span>
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="neutral"
                      label="Edit {bill.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(bill)}
                    />
                    <IconActionButton
                      variant="amber"
                      label="Pause {bill.name}"
                      path={mdiPause}
                      onclick={() => handlePause(bill)}
                    />
                    <IconActionButton
                      variant="muted"
                      label="Archive {bill.name}"
                      path={mdiArchive}
                      onclick={() => handleArchive(bill)}
                    />
                  </span>
                </td>
                <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell">
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Category</span
                  >
                  <CategorySelect
                    {categories}
                    value={bill.categoryId}
                    onchange={(value) => handleCategoryChange(bill, value)}
                    variant="table"
                  />
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Amount</span
                  >
                  {formatCurrency(bill.amount)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Frequency</span
                  >
                  {frequencyLabel(bill)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Next due</span
                  >
                  {formatDate(bill.nextDueOn)}
                </td>
                <td class="px-3 py-2 sm:table-cell">
                  {#if bill.dueSoon}
                    <span
                      class={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        bill.daysUntilDue !== null && bill.daysUntilDue < 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                      ]}
                    >
                      {formatDaysUntilDue(bill.daysUntilDue)}
                    </span>
                  {:else}
                    <span class="text-xs text-slate-500 dark:text-slate-400">
                      {formatDaysUntilDue(bill.daysUntilDue)}
                    </span>
                  {/if}
                </td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="neutral"
                    label="Edit {bill.name}"
                    path={mdiPencil}
                    onclick={() => startEdit(bill)}
                  />
                  <IconActionButton
                    variant="amber"
                    label="Pause {bill.name}"
                    path={mdiPause}
                    onclick={() => handlePause(bill)}
                  />
                  <IconActionButton
                    variant="muted"
                    label="Archive {bill.name}"
                    path={mdiArchive}
                    onclick={() => handleArchive(bill)}
                  />
                </td>
              </tr>
            {/if}
          {/each}
        {/each}

        {#if showHidden}
          {#if pausedBills.length > 0}
            <tr
              class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="7"
                class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
              >
                Paused
              </td>
            </tr>
            {#each pausedBills as bill (bill.id)}
              {#if editingId === bill.id}
                {@render editRow(bill)}
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white opacity-70 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
                >
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                  >
                    <span class="flex min-w-0 items-center">
                      <span class="truncate">{bill.name}</span>
                      <StatusBadge label="Paused" tone="amber" />
                    </span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
                      <IconActionButton
                        variant="neutral"
                        label="Edit {bill.name}"
                        path={mdiPencil}
                        onclick={() => startEdit(bill)}
                      />
                      <IconActionButton
                        variant="success"
                        label="Unpause {bill.name}"
                        path={mdiPlay}
                        onclick={() => handleUnpause(bill)}
                      />
                      <IconActionButton
                        variant="muted"
                        label="Archive {bill.name}"
                        path={mdiArchive}
                        onclick={() => handleArchive(bill)}
                      />
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Category</span
                    >
                    {categories.find((c) => c.id === bill.categoryId)?.name ?? 'Uncategorized'}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Amount</span
                    >
                    {formatCurrency(bill.amount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Frequency</span
                    >
                    {frequencyLabel(bill)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Next due</span
                    >
                    {formatDate(bill.nextDueOn)}
                  </td>
                  <td class="hidden px-3 py-2 sm:table-cell"></td>
                  <td
                    class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="neutral"
                      label="Edit {bill.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(bill)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unpause {bill.name}"
                      path={mdiPlay}
                      onclick={() => handleUnpause(bill)}
                    />
                    <IconActionButton
                      variant="muted"
                      label="Archive {bill.name}"
                      path={mdiArchive}
                      onclick={() => handleArchive(bill)}
                    />
                  </td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if archivedBills.length > 0}
            <tr
              class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="7"
                class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
              >
                Archived
              </td>
            </tr>
            {#each archivedBills as bill (bill.id)}
              {#if editingId === bill.id}
                {@render editRow(bill)}
              {:else}
                <tr
                  class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white opacity-70 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
                >
                  <td
                    class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                  >
                    <span class="flex min-w-0 items-center">
                      <span class="truncate">{bill.name}</span>
                      <StatusBadge label="Archived" tone="slate" />
                    </span>
                    <span class="flex shrink-0 items-center gap-1 sm:hidden">
                      <IconActionButton
                        variant="neutral"
                        label="Edit {bill.name}"
                        path={mdiPencil}
                        onclick={() => startEdit(bill)}
                      />
                      <IconActionButton
                        variant="success"
                        label="Unarchive {bill.name}"
                        path={mdiPackageUp}
                        onclick={() => handleUnarchive(bill)}
                      />
                      <IconActionButton
                        variant="danger"
                        label="Delete {bill.name}"
                        path={mdiDelete}
                        onclick={() => handleDelete(bill)}
                      />
                    </span>
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Category</span
                    >
                    {categories.find((c) => c.id === bill.categoryId)?.name ?? 'Uncategorized'}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Amount</span
                    >
                    {formatCurrency(bill.amount)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Frequency</span
                    >
                    {frequencyLabel(bill)}
                  </td>
                  <td
                    class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                  >
                    <span
                      class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                      >Next due</span
                    >
                    {formatDate(bill.nextDueOn)}
                  </td>
                  <td class="hidden px-3 py-2 sm:table-cell"></td>
                  <td
                    class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                  >
                    <IconActionButton
                      variant="neutral"
                      label="Edit {bill.name}"
                      path={mdiPencil}
                      onclick={() => startEdit(bill)}
                    />
                    <IconActionButton
                      variant="success"
                      label="Unarchive {bill.name}"
                      path={mdiPackageUp}
                      onclick={() => handleUnarchive(bill)}
                    />
                    <IconActionButton
                      variant="danger"
                      label="Delete {bill.name}"
                      path={mdiDelete}
                      onclick={() => handleDelete(bill)}
                    />
                  </td>
                </tr>
              {/if}
            {/each}
          {/if}

          {#if removedBills.length > 0}
            <tr
              class="block border-b border-slate-100 bg-slate-50 sm:table-row dark:border-slate-700/60 dark:bg-slate-900/40"
            >
              <td
                colspan="7"
                class="block px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:table-cell dark:text-slate-400"
              >
                Removed
              </td>
            </tr>
            {#each removedBills as bill (bill.id)}
              <tr
                class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white opacity-60 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
              >
                <td
                  class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-700 sm:table-cell sm:min-h-0 dark:text-slate-300"
                >
                  <span class="flex min-w-0 items-center">
                    <span class="truncate">{bill.name}</span>
                    <StatusBadge label="Removed" tone="slate" />
                  </span>
                  <span class="flex shrink-0 items-center gap-1 sm:hidden">
                    <IconActionButton
                      variant="success"
                      label="Restore {bill.name}"
                      path={mdiRestore}
                      onclick={() => handleRestore(bill)}
                    />
                  </span>
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Category</span
                  >
                  {categories.find((c) => c.id === bill.categoryId)?.name ?? 'Uncategorized'}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell sm:text-right dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Amount</span
                  >
                  {formatCurrency(bill.amount)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Frequency</span
                  >
                  {frequencyLabel(bill)}
                </td>
                <td
                  class="flex items-center justify-between gap-3 px-3 py-2 text-slate-500 sm:table-cell dark:text-slate-400"
                >
                  <span
                    class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
                    >Next due</span
                  >
                  {formatDate(bill.nextDueOn)}
                </td>
                <td class="hidden px-3 py-2 sm:table-cell"></td>
                <td
                  class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
                >
                  <IconActionButton
                    variant="success"
                    label="Restore {bill.name}"
                    path={mdiRestore}
                    onclick={() => handleRestore(bill)}
                  />
                </td>
              </tr>
            {/each}
          {/if}
        {/if}
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
        placeholder="e.g. Netflix"
        class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Category</span>
      <CategorySelect {categories} value={categoryId} onchange={(v) => (categoryId = v)} />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</span>
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={amount}
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
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Next due</span>
      <input
        type="date"
        bind:value={nextDueOn}
        class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </label>
    <PrimaryButton type="submit" disabled={creating}>
      {creating ? 'Adding…' : 'Add bill'}
    </PrimaryButton>
  </form>
{/if}
