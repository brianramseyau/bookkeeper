<script lang="ts">
  import type { PushSubscriptionRecord } from '$lib/api/push-subscriptions'
  import { formatDateTime } from '$lib/format'
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
  <p class="text-muted-foreground mt-3 text-sm">No devices registered yet</p>
{:else}
  <div class="mt-3 sm:overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-border border-b">
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Device</th>
          <th class="text-muted-foreground px-3 py-2 text-left font-medium">Registered</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each devices as device (device.id)}
          <tr class="border-border border-b last:border-0">
            <td class="text-foreground px-3 py-2 font-medium">
              {device.userAgent ?? 'Unknown device'}
            </td>
            <td class="text-muted-foreground font-figures px-3 py-2">
              {formatDateTime(device.createdAt)}
            </td>
            <td class="px-3 py-2 text-right">
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
  </div>
{/if}
