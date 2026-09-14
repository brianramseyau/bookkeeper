<script lang="ts">
  // Dev-only design specimen for Phase 1 (tokens, type, primitives) - shows
  // the Polymer palette, the three type roles, the shared button/menu/sheet/
  // dialog primitives, and a sample list row, all in one place to screenshot
  // and check against DESIGN.md with /frontend-design. Removed in Phase 6
  // (see foundational/PLAN_01_PHASE_06_DOCS_CLEANUP.md).
  import { mdiDotsVertical, mdiPencil, mdiArchive, mdiDelete } from '@mdi/js'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import HelpTooltip from '$lib/components/HelpTooltip.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import StatGrid from '$lib/components/app/StatGrid.svelte'
  import StatCard from '$lib/components/app/StatCard.svelte'
  import EmptyState from '$lib/components/app/EmptyState.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import ConfirmDialog from '$lib/components/app/ConfirmDialog.svelte'
  import ResponsiveFormSheet from '$lib/components/app/ResponsiveFormSheet.svelte'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'

  const SWATCHES = [
    { name: 'ground', class: 'bg-ground border' },
    { name: 'surface', class: 'bg-surface border' },
    { name: 'ink', class: 'bg-ink' },
    { name: 'muted-ink', class: 'bg-muted-ink' },
    { name: 'rule', class: 'bg-rule' },
    { name: 'violet', class: 'bg-violet' },
    { name: 'in', class: 'bg-in' },
    { name: 'due', class: 'bg-due' },
    { name: 'over', class: 'bg-over' },
  ]

  let confirmOpen = $state(false)
  let sheetOpen = $state(false)
  let lastConfirmResult = $state<string | null>(null)

  async function tryConfirmDestructive() {
    const ok = await confirmDestructive({
      title: 'Delete "Groceries"?',
      description: 'This cannot be undone.',
    })
    lastConfirmResult = ok ? 'Confirmed' : 'Cancelled'
  }
</script>

<PageHeader
  title="Design specimen"
  description="Dev-only page for checking the Polymer tokens, type and shared primitives together. Not part of the app."
/>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">Colour</h2>
<div class="grid grid-cols-3 gap-3 sm:grid-cols-9">
  {#each SWATCHES as swatch (swatch.name)}
    <div class="flex flex-col items-center gap-1">
      <div class={['h-12 w-12 rounded-lg', swatch.class]}></div>
      <span class="font-figures text-xs text-muted-foreground">{swatch.name}</span>
    </div>
  {/each}
</div>
<div class="mt-3 flex flex-wrap gap-2">
  <Badge class="border-in-tint bg-in-tint text-in border">In</Badge>
  <Badge class="border-due-tint bg-due-tint text-due border">Due</Badge>
  <Badge class="border-over-tint bg-over-tint text-over border">Over</Badge>
  <!-- shadcn's own Badge/Button destructive variants, not our custom
       -over-tint - both key off --destructive (=--over), checked
       separately since they use Tailwind's own opacity modifier
       (bg-destructive/10, /20) rather than our color-mix tint vars. -->
  <Badge variant="destructive">Destructive badge</Badge>
</div>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">Type</h2>
<Card class="flex flex-col gap-3 p-4">
  <p class="font-display text-2xl text-foreground">Display: are we OK this month?</p>
  <p class="text-sm text-foreground">
    UI/body: the whole app's running text uses this role, at 12/13/14/16/20/24/30px.
  </p>
  <p class="font-figures text-2xl text-foreground">$1,240.00</p>
  <p class="text-xs text-muted-foreground">Figures: MONO 1, tabular-nums, right-aligned in tables.</p>
</Card>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">Stats</h2>
<StatGrid cols={3}>
  <StatCard label="Projected net" value="$1,240.00" tone="positive" hint="Carried over plus projected income." />
  <StatCard label="Variance" value="-$80.00" tone="negative" />
  <StatCard label="Cash on hand" value="$500.00" />
</StatGrid>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">Buttons</h2>
<div class="flex flex-wrap items-center gap-2">
  <Button>Save changes</Button>
  <Button variant="outline">Cancel</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="destructive">Delete</Button>
  <Button variant="link">Link</Button>
  <Button disabled>Disabled</Button>
</div>
<div class="mt-3 flex items-center gap-2">
  <IconActionButton variant="neutral" label="Edit Groceries" path={mdiPencil} onclick={() => {}} />
  <IconActionButton variant="amber" label="Pause Groceries" path={mdiPencil} onclick={() => {}} />
  <IconActionButton variant="muted" label="Archive Groceries" path={mdiArchive} onclick={() => {}} />
  <IconActionButton variant="danger" label="Delete Groceries" path={mdiDelete} onclick={() => {}} />
  <IconActionButton variant="success" label="Restore Groceries" path={mdiPencil} onclick={() => {}} />
  <HelpTooltip label="Why is this estimated?" text="No record for this month this far back." />
</div>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">A sample list row</h2>
<Card class="sm:overflow-x-auto">
  <div class="flex items-center justify-between gap-3 px-3 py-3">
    <div class="min-w-0">
      <p class="truncate font-medium text-foreground">
        Groceries <Badge variant="secondary" class="ml-1">Paused</Badge>
      </p>
      <p class="text-xs text-muted-foreground">Food · adhoc expense</p>
    </div>
    <div class="flex shrink-0 items-center gap-3">
      <div class="text-right">
        <p class="font-figures text-foreground">$380.00</p>
        <Badge class="border-due-tint bg-due-tint text-due border">Due in 4 days</Badge>
      </div>
      <ActionMenu
        label="Actions for Groceries"
        actions={[
          { label: 'Edit', path: mdiPencil, variant: 'neutral', onclick: () => {} },
          { label: 'Archive', path: mdiArchive, variant: 'muted', onclick: () => {} },
          { label: 'Delete', path: mdiDelete, variant: 'danger', onclick: () => {} },
        ]}
      />
    </div>
  </div>
</Card>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">Empty / loading states</h2>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <Card class="p-4">
    <EmptyState message="No bills yet. Add the first one to see when it's due.">
      {#snippet action()}
        <Button size="sm">Add bill</Button>
      {/snippet}
    </EmptyState>
  </Card>
  <Card class="p-4">
    <LoadingSkeleton rows={4} />
  </Card>
</div>

<h2 class="mt-8 mb-3 text-lg font-semibold text-foreground">Sheet &amp; dialog</h2>
<div class="flex flex-wrap items-center gap-3">
  <Button onclick={() => (sheetOpen = true)}>Add bill</Button>
  <Button variant="outline" onclick={() => (confirmOpen = true)}>Delete (declarative)</Button>
  <Button variant="outline" onclick={tryConfirmDestructive}>Delete (imperative)</Button>
  {#if lastConfirmResult}
    <span class="text-sm text-muted-foreground">{lastConfirmResult}</span>
  {/if}
</div>

<ResponsiveFormSheet
  open={sheetOpen}
  onOpenChange={(open) => (sheetOpen = open)}
  title="Add bill"
  description="Log a new recurring bill."
>
  <div class="flex flex-col gap-3 py-2">
    <label class="flex flex-col gap-1">
      <span class="text-xs font-medium text-muted-foreground">Name</span>
      <input
        type="text"
        class="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
        placeholder="e.g. Netflix"
      />
    </label>
  </div>
  {#snippet footer()}
    <Button variant="outline" onclick={() => (sheetOpen = false)}>Cancel</Button>
    <Button onclick={() => (sheetOpen = false)}>Save changes</Button>
  {/snippet}
</ResponsiveFormSheet>

<ConfirmDialog
  open={confirmOpen}
  onOpenChange={(open) => (confirmOpen = open)}
  title='Delete "Groceries"?'
  description="This cannot be undone."
  onConfirm={() => {
    confirmOpen = false
    lastConfirmResult = 'Confirmed (declarative)'
  }}
/>

<div class="mt-8">
  <ActionMenu
    label="Add income"
    actions={[
      { label: 'Salary', path: mdiPencil, onclick: () => {} },
      { label: 'Other income', path: mdiDotsVertical, onclick: () => {} },
    ]}
  >
    {#snippet trigger(triggerProps)}
      <Button {...triggerProps}>Add ▾</Button>
    {/snippet}
  </ActionMenu>
</div>
