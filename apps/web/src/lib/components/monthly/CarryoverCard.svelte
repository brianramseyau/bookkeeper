<script lang="ts">
  import type { EditState } from '$lib/edit-state.svelte'
  import { formatCurrency } from '$lib/format'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import { mdiPencil, mdiCloseThick, mdiContentSave } from '@mdi/js'

  interface Props {
    carryover: number
    editState: EditState<true, { amount: number }>
    onStartEdit: () => void
    onSave: () => void
  }

  let { carryover, editState, onStartEdit, onSave }: Props = $props()
</script>

<Card class="mt-3 sm:overflow-x-auto" pivotTable>
  <table class="block w-full border-collapse text-sm sm:table sm:table-fixed">
    <colgroup>
      <col class="sm:w-[12%]" />
      <col class="sm:w-[16%]" />
      <col class="sm:w-[14%]" />
      <col class="sm:w-[14%]" />
      <col class="sm:w-[14%]" />
      <col class="sm:w-[25%]" />
      <col class="sm:w-[5%]" />
    </colgroup>
    <tbody class="block sm:table-row-group">
      <tr
        class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 dark:divide-slate-700/60 dark:border-slate-700 dark:bg-slate-800/60"
      >
        <td
          class="flex min-h-9 items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:min-h-0 dark:text-slate-100"
          colspan="3"
        >
          <span class="min-w-0 truncate">Carried over from last month</span>
          <span class="flex shrink-0 items-center gap-1 sm:hidden">
            {#if !editState.isEditing}
              <IconActionButton
                variant="neutral"
                label="Edit carried over balance"
                path={mdiPencil}
                onclick={onStartEdit}
              />
            {:else}
              <IconActionButton
                variant="primary"
                disabled={editState.saving}
                label="Save carried over balance"
                path={mdiContentSave}
                onclick={onSave}
              />
              <IconActionButton
                variant="cancel"
                label="Cancel editing carried over balance"
                path={mdiCloseThick}
                onclick={() => editState.cancel()}
              />
            {/if}
          </span>
        </td>
        {#if editState.isEditing && editState.form}
          <td class="hidden px-3 py-2 sm:table-cell"></td>
          <td class="flex items-center justify-between gap-3 px-3 py-2 sm:table-cell sm:text-right">
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Actual</span
            >
            <input
              type="number"
              step="0.01"
              bind:value={editState.form.amount}
              class="w-full rounded-md border border-slate-300 px-2 py-1 text-right text-sm sm:w-24 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </td>
          <td
            class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
            colspan="2"
          >
            <IconActionButton
              variant="primary"
              disabled={editState.saving}
              label="Save carried over balance"
              path={mdiContentSave}
              onclick={onSave}
            />
            <IconActionButton
              variant="cancel"
              label="Cancel editing carried over balance"
              path={mdiCloseThick}
              onclick={() => editState.cancel()}
            />
          </td>
        {:else}
          <td class="hidden px-3 py-2 sm:table-cell"></td>
          <td
            class="flex items-center justify-between gap-3 px-3 py-2 font-medium text-slate-900 sm:table-cell sm:text-right dark:text-slate-100"
          >
            <span
              class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500"
              >Actual</span
            >
            {formatCurrency(carryover)}
          </td>
          <td
            class="hidden justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right"
            colspan="2"
          >
            <IconActionButton
              variant="neutral"
              label="Edit carried over balance"
              path={mdiPencil}
              onclick={onStartEdit}
            />
          </td>
        {/if}
      </tr>
    </tbody>
  </table>
</Card>
