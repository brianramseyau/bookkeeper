<script lang="ts">
  import type { IncomeSource } from '$lib/api/income'
  import type { UserSummary } from '$lib/api/users'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { Button } from '$lib/components/ui/button'
  import IncomeEntryForm, {
    type IncomeEntryFormValues,
  } from '$lib/components/IncomeEntryForm.svelte'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    sources: IncomeSource[]
    users: UserSummary[]
    submitting: boolean
    error?: string | null
    /** Resolve `true` to close the sheet (a successful log). */
    onSubmit: (values: IncomeEntryFormValues) => Promise<boolean>
  }

  let { open, onOpenChange, sources, users, submitting, error, onSubmit }: Props = $props()

  async function submit(values: IncomeEntryFormValues): Promise<boolean> {
    const ok = await onSubmit(values)
    if (ok) onOpenChange(false)
    return ok
  }
</script>

<ResponsiveFormSheet {open} {onOpenChange} title="Log income">
  <IncomeEntryForm
    formId="monthly-log-income-form"
    showSubmit={false}
    {sources}
    {users}
    allowUnattributed
    {submitting}
    class="flex flex-col gap-4 py-2"
    onSubmit={submit}
  />

  {#snippet footer()}
    {#if error}
      <p class="text-over mr-auto text-sm">{error}</p>
    {/if}
    <Button variant="outline" onclick={() => onOpenChange(false)} disabled={submitting}>
      Cancel
    </Button>
    <Button type="submit" form="monthly-log-income-form" disabled={submitting}>
      {submitting ? 'Logging…' : 'Log income'}
    </Button>
  {/snippet}
</ResponsiveFormSheet>
