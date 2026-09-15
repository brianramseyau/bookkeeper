<script lang="ts">
  import type { IncomeSource } from '$lib/api/income'
  import { formatCurrency } from '$lib/format'
  import { cadenceLabel } from '$lib/income-sources'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPencil, mdiDelete } from '@mdi/js'

  interface Props {
    sources: IncomeSource[]
    onEdit: (source: IncomeSource) => void
    onDelete: (source: IncomeSource) => void
  }

  let { sources, onEdit, onDelete }: Props = $props()
</script>

<Card class="mt-3 sm:overflow-x-auto" pivotTable>
  <table class="block w-full border-collapse text-sm sm:table">
    <thead class="hidden sm:table-header-group">
      <tr class="border-border border-b">
        <th class="text-muted-foreground px-3 py-2 text-left font-medium">Name</th>
        <th class="text-muted-foreground px-3 py-2 text-right font-medium">Expected per pay</th>
        <th class="text-muted-foreground px-3 py-2 text-left font-medium">Cadence</th>
        <th class="text-muted-foreground px-3 py-2 text-left font-medium">Tax withheld</th>
        <th class="px-3 py-2"></th>
      </tr>
    </thead>
    <tbody class="block sm:table-row-group">
      {#each sources as source (source.id)}
        <tr
          class="divide-border border-border bg-card mb-2 block divide-y rounded-lg border last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:bg-transparent sm:last:border-0"
        >
          <td
            class="text-foreground flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium sm:table-cell sm:min-h-0"
          >
            <span class="min-w-0 truncate">{source.name}</span>
            <span class="flex shrink-0 items-center gap-1 sm:hidden">
              <IconActionButton
                variant="neutral"
                label="Edit {source.name}"
                path={mdiPencil}
                onclick={() => onEdit(source)}
              />
              <IconActionButton
                variant="danger"
                label="Delete {source.name}"
                path={mdiDelete}
                onclick={() => onDelete(source)}
              />
            </span>
          </td>
          <td
            class="text-foreground font-figures flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right"
          >
            <span class="text-muted-foreground shrink-0 text-xs font-medium sm:hidden"
              >Expected per pay</span
            >
            {formatCurrency(source.expectedAmount)}
          </td>
          <td
            class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell"
          >
            <span class="shrink-0 text-xs font-medium sm:hidden">Cadence</span>
            {cadenceLabel(source)}
          </td>
          <td
            class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2 sm:table-cell"
          >
            <span class="shrink-0 text-xs font-medium sm:hidden">Tax withheld</span>
            {source.taxWithheld ? 'Yes' : 'No'}
          </td>
          <td
            class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
          >
            <IconActionButton
              variant="neutral"
              label="Edit {source.name}"
              path={mdiPencil}
              onclick={() => onEdit(source)}
            />
            <IconActionButton
              variant="danger"
              label="Delete {source.name}"
              path={mdiDelete}
              onclick={() => onDelete(source)}
            />
          </td>
        </tr>
      {:else}
        <tr class="block sm:table-row">
          <td
            colspan="5"
            class="text-muted-foreground block px-3 py-6 text-center text-sm sm:table-cell"
          >
            No income sources yet.
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</Card>
