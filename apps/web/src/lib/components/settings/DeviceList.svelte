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
  <div class="mt-3 overflow-x-auto">
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
            class="divide-border border-border mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
          >
            <td
              class="flex min-h-12 items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:min-h-0"
            >
              <span class="flex min-w-0 flex-col">
                <span class="text-foreground truncate font-medium">
                  {device.userAgent ?? 'Unknown device'}
                </span>
                <span class="text-muted-foreground font-figures text-xs sm:hidden">
                  {formatDateTime(device.createdAt)}
                </span>
              </span>
              <span class="shrink-0 sm:hidden">
                <IconActionButton
                  variant="danger"
                  disabled={deletingDeviceId === device.id}
                  label="Delete {device.userAgent ?? 'Unknown device'}"
                  path={mdiDelete}
                  onclick={() => onDelete(device)}
                />
              </span>
            </td>
            <td class="text-muted-foreground font-figures hidden px-3 py-2 sm:table-cell">
              {formatDateTime(device.createdAt)}
            </td>
            <td class="hidden px-3 py-2 text-right sm:table-cell">
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
