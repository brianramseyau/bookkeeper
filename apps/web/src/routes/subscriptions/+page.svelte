<script lang="ts">
  import { onMount } from 'svelte'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { getSubscriptionsSummary, type SubscriptionSummary } from '$lib/api/subscriptions'
  import { ApiError } from '$lib/api'
  import { formatCurrency } from '$lib/format'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { subscriptionsAdapter } from '$lib/outgoings/subscriptions'

  let users = $state<UserSummary[]>([])
  let summaries = $state<SubscriptionSummary[]>([])
  let selectedUserId = $state<number | undefined>(undefined)
  let error = $state<string | null>(null)

  onMount(load)

  async function load() {
    error = null
    try {
      const [userList, summaryList] = await Promise.all([listUsers(), getSubscriptionsSummary()])
      users = userList
      summaries = summaryList
      selectedUserId = userList[0]?.id
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load subscriptions'
    }
  }

  function totalFor(userId: number): number {
    return summaries.find((s) => s.userId === userId)?.total ?? 0
  }
</script>

<svelte:head>
  <title>Subscriptions · Bookkeeper</title>
</svelte:head>

{#if error}
  <PageHeader title="Subscriptions" description={subscriptionsAdapter.description} />
  <ErrorMessage message={error} />
{:else if selectedUserId === undefined}
  <LoadingSkeleton rows={4} />
{:else}
  {#key selectedUserId}
    <OutgoingsList
      adapter={subscriptionsAdapter}
      userId={selectedUserId}
      addDefaults={{ userId: selectedUserId }}
    >
      {#snippet header()}
        <div class="flex flex-wrap gap-2">
          {#each users as user (user.id)}
            <button
              type="button"
              onclick={() => (selectedUserId = user.id)}
              class={[
                'rounded-full border px-3 py-1 text-sm transition-colors',
                selectedUserId === user.id
                  ? 'border-primary bg-accent text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent',
              ]}
            >
              {user.fullName ?? user.email}
              <span class="ml-1 text-xs text-muted-foreground"
                >{formatCurrency(totalFor(user.id))}/mo</span
              >
            </button>
          {/each}
        </div>
      {/snippet}
    </OutgoingsList>
  {/key}
{/if}
