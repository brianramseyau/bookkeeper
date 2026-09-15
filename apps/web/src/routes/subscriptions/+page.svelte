<script lang="ts">
  import { onMount } from 'svelte'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { getSubscriptionsSummary, type SubscriptionSummary } from '$lib/api/subscriptions'
  import { formatCurrency } from '$lib/format'
  import OutgoingsList from '$lib/outgoings/OutgoingsList.svelte'
  import { subscriptionsAdapter } from '$lib/outgoings/subscriptions'

  let users = $state<UserSummary[]>([])
  let summaries = $state<SubscriptionSummary[]>([])
  let selectedUserId = $state<number | undefined>(undefined)

  onMount(load)

  async function load() {
    const [userList, summaryList] = await Promise.all([listUsers(), getSubscriptionsSummary()])
    users = userList
    summaries = summaryList
    if (selectedUserId === undefined) selectedUserId = userList[0]?.id
  }

  function totalFor(userId: number): number {
    return summaries.find((s) => s.userId === userId)?.total ?? 0
  }
</script>

<svelte:head>
  <title>Subscriptions · Bookkeeper</title>
</svelte:head>

{#key selectedUserId}
  <OutgoingsList
    adapter={subscriptionsAdapter}
    userId={selectedUserId}
    addDefaults={selectedUserId !== undefined ? { userId: selectedUserId } : undefined}
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
            <span class="text-muted-foreground ml-1 text-xs"
              >{formatCurrency(totalFor(user.id))}/mo</span
            >
          </button>
        {/each}
      </div>
    {/snippet}
  </OutgoingsList>
{/key}
