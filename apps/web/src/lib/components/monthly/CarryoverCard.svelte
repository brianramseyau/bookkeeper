<script lang="ts">
  import type { EditState } from '$lib/edit-state.svelte'
  import { formatCurrency } from '$lib/format'
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

<div
  class="border-rule bg-surface mt-3 flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3"
>
  <span class="text-foreground font-medium">Carried over from last month</span>
  {#if editState.isEditing && editState.form}
    <div class="flex items-center gap-2">
      <label class="sr-only" for="carryover-amount">Carried over amount</label>
      <input
        id="carryover-amount"
        type="number"
        step="0.01"
        bind:value={editState.form.amount}
        class="border-input w-28 rounded-md border px-2 py-1 text-right text-sm"
      />
      <IconActionButton
        variant="primary"
        disabled={editState.saving}
        label="Save carried over balance"
        path={mdiContentSave}
        onclick={onSave}
        class="size-11"
      />
      <IconActionButton
        variant="cancel"
        label="Cancel editing carried over balance"
        path={mdiCloseThick}
        onclick={() => editState.cancel()}
        class="size-11"
      />
    </div>
  {:else}
    <div class="flex items-center gap-2">
      <span class="font-figures text-foreground font-medium">{formatCurrency(carryover)}</span>
      <IconActionButton
        variant="neutral"
        label="Edit carried over balance"
        path={mdiPencil}
        onclick={onStartEdit}
        class="size-11"
      />
    </div>
  {/if}
</div>
