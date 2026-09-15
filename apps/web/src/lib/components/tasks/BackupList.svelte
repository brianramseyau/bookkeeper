<script lang="ts">
  import type { Backup } from '$lib/api/backups'
  import { backupDownloadUrl } from '$lib/api/backups'
  import { formatDateTime, formatFileSize } from '$lib/format'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiDelete } from '@mdi/js'

  interface Props {
    backups: Backup[]
    deletingFilename: string | null
    onDelete: (backup: Backup) => void
  }

  let { backups, deletingFilename, onDelete }: Props = $props()
</script>

<Card class="mt-3 overflow-x-auto">
  <table class="w-full border-collapse text-sm">
    <tbody>
      {#each backups as backup (backup.filename)}
        <tr class="border-border border-b last:border-0">
          <td class="text-foreground font-figures px-3 py-2 font-medium">
            {formatDateTime(backup.createdAt)}
          </td>
          <td class="text-muted-foreground px-3 py-2">{formatFileSize(backup.sizeBytes)}</td>
          <td class="flex items-center justify-end gap-2 px-3 py-2 text-right">
            <a
              href={backupDownloadUrl(backup.filename)}
              class="text-primary text-xs font-medium hover:underline"
            >
              Download
            </a>
            <IconActionButton
              variant="danger"
              disabled={deletingFilename === backup.filename}
              label="Delete backup from {formatDateTime(backup.createdAt)}"
              path={mdiDelete}
              onclick={() => onDelete(backup)}
            />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</Card>
