<script lang="ts">
  import { onMount } from 'svelte'
  import {
    listSubscriptions,
    getSubscriptionsSummary,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    type UserSubscription,
    type SubscriptionSummary,
  } from '$lib/api/subscriptions'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { listCategories, type Category } from '$lib/api/categories'
  import { formatCurrency } from '$lib/format'
  import { ApiError } from '$lib/api'
  import Card from '$lib/components/Card.svelte'
  import CategorySelect from '$lib/components/CategorySelect.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte'
  import PageHead from '$lib/components/PageHead.svelte'
  import PrimaryButton from '$lib/components/PrimaryButton.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import TextActionButton from '$lib/components/TextActionButton.svelte'

  let users = $state<UserSummary[]>([])
  let summaries = $state<SubscriptionSummary[]>([])
  let categories = $state<Category[]>([])
  let subscriptions = $state<UserSubscription[]>([])
  let selectedUserId = $state<number | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let showHidden = $state(false)

  let name = $state('')
  let amount = $state<number>(NaN)
  let dayOfMonth = $state<number>(NaN)
  let categoryId = $state('')
  let creating = $state(false)

  let editingId = $state<number | null>(null)
  let editName = $state('')
  let editAmount = $state<number>(NaN)
  let editDayOfMonth = $state<number>(NaN)
  let savingEdit = $state(false)

  const userSubscriptions = $derived(subscriptions.filter((s) => s.userId === selectedUserId))
  const activeSubscriptions = $derived(
    userSubscriptions.filter((s) => s.isActive && !s.isPaused && !s.isArchived)
  )
  const pausedSubscriptions = $derived(
    userSubscriptions.filter((s) => s.isActive && s.isPaused && !s.isArchived)
  )
  const archivedSubscriptions = $derived(
    userSubscriptions.filter((s) => s.isActive && s.isArchived)
  )
  const removedSubscriptions = $derived(userSubscriptions.filter((s) => !s.isActive))

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      await refresh()
    } finally {
      loading = false
    }
  }

  // Re-fetches without touching `loading` - toggling `loading` swaps the
  // whole page to a "Loading…" placeholder, which unmounts the table and
  // resets scroll position on every add/edit/pause/archive action.
  async function refresh() {
    try {
      const [userList, summaryList, categoryList, subscriptionList] = await Promise.all([
        listUsers(),
        getSubscriptionsSummary(),
        listCategories(),
        listSubscriptions({ includeHidden: true }),
      ])
      users = userList
      summaries = summaryList
      categories = categoryList
      subscriptions = subscriptionList
      if (selectedUserId === null && users.length > 0) {
        selectedUserId = users[0]!.id
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load subscriptions'
    }
  }

  async function handleCategoryChange(sub: UserSubscription, value: string) {
    error = null
    try {
      await updateSubscription(sub.id, { categoryId: value === '' ? null : Number(value) })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update category'
    }
  }

  async function handleDelete(sub: UserSubscription) {
    if (!confirm(`Permanently delete "${sub.name}"? This cannot be undone.`)) return
    error = null
    try {
      await deleteSubscription(sub.id)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handlePause(sub: UserSubscription) {
    error = null
    try {
      await updateSubscription(sub.id, { isPaused: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to pause'
    }
  }

  async function handleUnpause(sub: UserSubscription) {
    error = null
    try {
      await updateSubscription(sub.id, { isPaused: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unpause'
    }
  }

  async function handleArchive(sub: UserSubscription) {
    error = null
    try {
      await updateSubscription(sub.id, { isArchived: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to archive'
    }
  }

  async function handleUnarchive(sub: UserSubscription) {
    error = null
    try {
      await updateSubscription(sub.id, { isArchived: false })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to unarchive'
    }
  }

  async function handleRestore(sub: UserSubscription) {
    error = null
    try {
      await updateSubscription(sub.id, { isActive: true })
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to restore'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (selectedUserId === null || !name.trim() || Number.isNaN(amount) || amount === null) {
      error = 'Name and amount are required'
      return
    }
    creating = true
    error = null
    try {
      await createSubscription({
        userId: selectedUserId,
        name: name.trim(),
        amount,
        dayOfMonth: Number.isNaN(dayOfMonth) ? undefined : dayOfMonth,
        categoryId: categoryId === '' ? undefined : Number(categoryId),
      })
      name = ''
      amount = NaN
      dayOfMonth = NaN
      categoryId = ''
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to add subscription'
    } finally {
      creating = false
    }
  }

  function startEdit(sub: UserSubscription) {
    editingId = sub.id
    editName = sub.name
    editAmount = sub.amount
    editDayOfMonth = sub.dayOfMonth ?? NaN
  }

  function cancelEdit() {
    editingId = null
  }

  async function saveEdit(sub: UserSubscription) {
    if (!editName.trim() || Number.isNaN(editAmount) || editAmount === null) {
      error = 'Name and amount are required'
      return
    }
    savingEdit = true
    error = null
    try {
      await updateSubscription(sub.id, {
        name: editName.trim(),
        amount: editAmount,
        dayOfMonth: Number.isNaN(editDayOfMonth) ? null : editDayOfMonth,
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

{#snippet editRow(sub: UserSubscription)}
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
    <td class="px-3 py-2">
      <CategorySelect
        {categories}
        value={sub.categoryId}
        onchange={(value) => handleCategoryChange(sub, value)}
        variant="table"
      />
    </td>
    <td class="px-3 py-2 text-right">
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value={editAmount}
        class="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </td>
    <td class="px-3 py-2">
      <input
        type="number"
        min="1"
        max="31"
        placeholder="—"
        bind:value={editDayOfMonth}
        class="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </td>
    <td class="px-3 py-2 text-right whitespace-nowrap">
      <TextActionButton variant="primary" disabled={savingEdit} onclick={() => saveEdit(sub)}>
        Save
      </TextActionButton>
      <TextActionButton variant="cancel" class="ml-2" onclick={cancelEdit}>Cancel</TextActionButton>
    </td>
  </tr>
{/snippet}

<PageHead title="Subscriptions" />

<div class="flex items-center justify-between">
  <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Personal Subscriptions</h1>
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
  <div class="mt-6 flex gap-2">
    {#each users as user (user.id)}
      {@const summary = summaries.find((s) => s.userId === user.id)}
      <button
        type="button"
        onclick={() => (selectedUserId = user.id)}
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
          {formatCurrency(summary?.total ?? 0)}/mo · {summary?.count ?? 0} subscription{summary?.count ===
          1
            ? ''
            : 's'}
        </span>
      </button>
    {/each}
  </div>

  {#if selectedUserId !== null}
    <Card class="mt-6 overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700">
            <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
              >Name</th
            >
            <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
              >Category</th
            >
            <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
              >Amount</th
            >
            <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
              >Day of month</th
            >
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each activeSubscriptions as sub (sub.id)}
            {#if editingId === sub.id}
              {@render editRow(sub)}
            {:else}
              <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                  {sub.name}
                </td>
                <td class="px-3 py-2">
                  <CategorySelect
                    {categories}
                    value={sub.categoryId}
                    onchange={(value) => handleCategoryChange(sub, value)}
                    variant="table"
                  />
                </td>
                <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(sub.amount)}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {sub.dayOfMonth ? `Day ${sub.dayOfMonth}` : '—'}
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <TextActionButton variant="neutral" onclick={() => startEdit(sub)}>
                    Edit
                  </TextActionButton>
                  <TextActionButton variant="amber" class="ml-2" onclick={() => handlePause(sub)}>
                    Pause
                  </TextActionButton>
                  <TextActionButton variant="muted" class="ml-2" onclick={() => handleArchive(sub)}>
                    Archive
                  </TextActionButton>
                </td>
              </tr>
            {/if}
          {:else}
            <tr>
              <td
                colspan="5"
                class="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                No subscriptions yet.
              </td>
            </tr>
          {/each}

          {#if showHidden}
            {#if pausedSubscriptions.length > 0}
              <tr
                class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <td
                  colspan="5"
                  class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  Paused
                </td>
              </tr>
              {#each pausedSubscriptions as sub (sub.id)}
                {#if editingId === sub.id}
                  {@render editRow(sub)}
                {:else}
                  <tr
                    class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                  >
                    <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                      {sub.name}
                      <StatusBadge label="Paused" tone="amber" />
                    </td>
                    <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {categories.find((c) => c.id === sub.categoryId)?.name ?? 'Uncategorized'}
                    </td>
                    <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                      {formatCurrency(sub.amount)}
                    </td>
                    <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {sub.dayOfMonth ? `Day ${sub.dayOfMonth}` : '—'}
                    </td>
                    <td class="px-3 py-2 text-right whitespace-nowrap">
                      <TextActionButton variant="neutral" onclick={() => startEdit(sub)}>
                        Edit
                      </TextActionButton>
                      <TextActionButton
                        variant="success"
                        class="ml-2"
                        onclick={() => handleUnpause(sub)}
                      >
                        Unpause
                      </TextActionButton>
                      <TextActionButton
                        variant="muted"
                        class="ml-2"
                        onclick={() => handleArchive(sub)}
                      >
                        Archive
                      </TextActionButton>
                    </td>
                  </tr>
                {/if}
              {/each}
            {/if}

            {#if archivedSubscriptions.length > 0}
              <tr
                class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <td
                  colspan="5"
                  class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  Archived
                </td>
              </tr>
              {#each archivedSubscriptions as sub (sub.id)}
                {#if editingId === sub.id}
                  {@render editRow(sub)}
                {:else}
                  <tr
                    class="border-b border-slate-100 opacity-70 last:border-0 dark:border-slate-700/60"
                  >
                    <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                      {sub.name}
                      <StatusBadge label="Archived" tone="slate" />
                    </td>
                    <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {categories.find((c) => c.id === sub.categoryId)?.name ?? 'Uncategorized'}
                    </td>
                    <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                      {formatCurrency(sub.amount)}
                    </td>
                    <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {sub.dayOfMonth ? `Day ${sub.dayOfMonth}` : '—'}
                    </td>
                    <td class="px-3 py-2 text-right whitespace-nowrap">
                      <TextActionButton variant="neutral" onclick={() => startEdit(sub)}>
                        Edit
                      </TextActionButton>
                      <TextActionButton
                        variant="success"
                        class="ml-2"
                        onclick={() => handleUnarchive(sub)}
                      >
                        Unarchive
                      </TextActionButton>
                      <TextActionButton
                        variant="danger"
                        class="-my-1 ml-1 p-1"
                        onclick={() => handleDelete(sub)}
                      >
                        Remove
                      </TextActionButton>
                    </td>
                  </tr>
                {/if}
              {/each}
            {/if}

            {#if removedSubscriptions.length > 0}
              <tr
                class="border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
              >
                <td
                  colspan="5"
                  class="px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  Removed
                </td>
              </tr>
              {#each removedSubscriptions as sub (sub.id)}
                <tr
                  class="border-b border-slate-100 opacity-60 last:border-0 dark:border-slate-700/60"
                >
                  <td class="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    {sub.name}
                    <StatusBadge label="Removed" tone="slate" />
                  </td>
                  <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {categories.find((c) => c.id === sub.categoryId)?.name ?? 'Uncategorized'}
                  </td>
                  <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                    {formatCurrency(sub.amount)}
                  </td>
                  <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {sub.dayOfMonth ? `Day ${sub.dayOfMonth}` : '—'}
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <TextActionButton variant="success" onclick={() => handleRestore(sub)}>
                      Restore
                    </TextActionButton>
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
          placeholder="e.g. Spotify"
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
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Day of month</span>
        <input
          type="number"
          min="1"
          max="31"
          bind:value={dayOfMonth}
          class="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <PrimaryButton type="submit" disabled={creating}>
        {creating ? 'Adding…' : 'Add subscription'}
      </PrimaryButton>
    </form>
  {/if}
{/if}
