<script lang="ts">
  import type { PushSubscriptionRecord } from '$lib/api/push-subscriptions'
  import { formatDateTime } from '$lib/format'
  import Card from '$lib/components/Card.svelte'
  import EmptyState from '$lib/components/app/EmptyState.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiDelete } from '@mdi/js'

  interface Props {
    devices: PushSubscriptionRecord[]
    loading: boolean
    deletingDeviceId: number | null
    onDelete: (device: PushSubscriptionRecord) => void
  }

  let { devices, loading, deletingDeviceId, onDelete }: Props = $props()
</script>

{#if loading}
  <div class="mt-3">
    <LoadingSkeleton rows={2} />
  </div>
{:else if devices.length === 0}
  <EmptyState message="No devices registered yet" />
{:else}
  <Card class="mt-3 sm:overflow-x-auto" pivotTable>
    <table class="block w-full border-collapse text-sm sm:table">
      <thead class="hidden sm:table-header-group">
        <tr class="border-border border-b">
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Device</th>
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Registered</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody class="block sm:table-row-group">
        {#each devices as device (device.id)}
          <tr
            class="divide-border border-border bg-card mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
          >
            <td
              class="text-foreground flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium sm:table-cell sm:min-h-0"
            >
              <span class="min-w-0 truncate">{device.userAgent ?? 'Unknown device'}</span>
              <span class="flex shrink-0 items-center gap-1 sm:hidden">
                <IconActionButton
                  variant="danger"
                  disabled={deletingDeviceId === device.id}
                  label="Delete {device.userAgent ?? 'Unknown device'}"
                  path={mdiDelete}
                  onclick={() => onDelete(device)}
                />
              </span>
            </td>
            <td
              class="text-muted-foreground font-figures flex items-center justify-between gap-3 px-3 py-2 sm:table-cell"
            >
              <span class="shrink-0 text-xs font-medium sm:hidden">Registered</span>
              {formatDateTime(device.createdAt)}
            </td>
            <td
              class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
            >
              <IconActionButton
                variant="danger"
                disabled={deletingDeviceId === device.id}
                label="Delete {device.userAgent ?? 'Unknown device'}"
                path={mdiDelete}
                onclick={() => onDelete(device)}
              />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
{/if}
