<script lang="ts">
  import type { UserSummary } from '$lib/api/users'
  import type { IncomeSourceSummary } from '$lib/api/income'
  import { formatCurrency } from '$lib/format'

  interface Props {
    users: UserSummary[]
    /** Each person's projected monthly income total, for the chip's meta. */
    summaries: IncomeSourceSummary[]
    selectedUserId: number | null
    onSelect: (userId: number) => void
  }

  let { users, summaries, selectedUserId, onSelect }: Props = $props()

  function totalFor(userId: number): number {
    return summaries.find((s) => s.userId === userId)?.total ?? 0
  }
</script>

<div class="flex flex-wrap gap-2">
  {#each users as user (user.id)}
    <button
      type="button"
      onclick={() => onSelect(user.id)}
      aria-pressed={selectedUserId === user.id}
      class={[
        'rounded-full border px-3 py-1 text-sm transition-colors',
        selectedUserId === user.id
          ? 'border-primary bg-accent text-primary'
          : 'border-border text-muted-foreground hover:bg-accent',
      ]}
    >
      {user.fullName ?? user.email}
      <span class="text-muted-foreground ml-1 text-xs">{formatCurrency(totalFor(user.id))}/mo</span>
    </button>
  {/each}
</div>
