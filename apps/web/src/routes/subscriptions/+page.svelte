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

  let users = $state<UserSummary[]>([])
  let summaries = $state<SubscriptionSummary[]>([])
  let categories = $state<Category[]>([])
  let subscriptions = $state<UserSubscription[]>([])
  let selectedUserId = $state<number | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)

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

  const visibleSubscriptions = $derived(subscriptions.filter((s) => s.userId === selectedUserId))

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [userList, summaryList, categoryList, subscriptionList] = await Promise.all([
        listUsers(),
        getSubscriptionsSummary(),
        listCategories(),
        listSubscriptions(),
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
    } finally {
      loading = false
    }
  }

  async function handleCategoryChange(sub: UserSubscription, value: string) {
    error = null
    try {
      await updateSubscription(sub.id, { categoryId: value === '' ? null : Number(value) })
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to update category'
    }
  }

  async function handleDelete(sub: UserSubscription) {
    error = null
    try {
      await deleteSubscription(sub.id)
      subscriptions = subscriptions.filter((s) => s.id !== sub.id)
      summaries = await getSubscriptionsSummary()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete'
    }
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault()
    if (selectedUserId === null || !name.trim() || Number.isNaN(amount)) {
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
      await load()
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
    if (!editName.trim() || Number.isNaN(editAmount)) {
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
      await load()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      savingEdit = false
    }
  }
</script>

<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Personal Subscriptions</h1>

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
    <div
      class="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800"
    >
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
          {#each visibleSubscriptions as sub (sub.id)}
            {#if editingId === sub.id}
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
                  <select
                    value={sub.categoryId ?? ''}
                    onchange={(e) => handleCategoryChange(sub, e.currentTarget.value)}
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <option value="">Uncategorized</option>
                    {#each categories as category (category.id)}
                      <option value={category.id}>{category.name}</option>
                    {/each}
                  </select>
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
                  <button
                    type="button"
                    onclick={() => saveEdit(sub)}
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
                  {sub.name}
                </td>
                <td class="px-3 py-2">
                  <select
                    value={sub.categoryId ?? ''}
                    onchange={(e) => handleCategoryChange(sub, e.currentTarget.value)}
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <option value="">Uncategorized</option>
                    {#each categories as category (category.id)}
                      <option value={category.id}>{category.name}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(sub.amount)}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {sub.dayOfMonth ? `Day ${sub.dayOfMonth}` : '—'}
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onclick={() => startEdit(sub)}
                    class="text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onclick={() => handleDelete(sub)}
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
                No subscriptions yet.
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
          placeholder="e.g. Spotify"
          class="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Category</span>
        <select
          bind:value={categoryId}
          class="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Uncategorized</option>
          {#each categories as category (category.id)}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
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
      <button
        type="submit"
        disabled={creating}
        class="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {creating ? 'Adding…' : 'Add subscription'}
      </button>
    </form>
  {/if}
{/if}
