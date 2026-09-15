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
      <tr class="border-b border-slate-200 dark:border-slate-700">
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Name</th>
        <th class="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
          >Expected per pay</th
        >
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Cadence</th
        >
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400"
          >Tax withheld</th
        >
        <th class="px-3 py-2"></th>
      </tr>
    </thead>
    <tbody class="block sm:table-row-group">
      {#each sources as source (source.id)}
        <tr
          class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:bg-transparent sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800 sm:dark:border-slate-700/60 sm:dark:bg-transparent"
        >
          <td
            class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
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
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Expected per pay</span
            >
            {formatCurrency(source.expectedAmount)}
          </td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Cadence</span
            >
            {cadenceLabel(source)}
          </td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 text-slate-600 sm:table-cell dark:text-slate-400"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Tax withheld</span
            >
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
            class="block px-3 py-6 text-center text-sm text-slate-400 sm:table-cell dark:text-slate-500"
          >
            No income sources yet.
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</Card>
