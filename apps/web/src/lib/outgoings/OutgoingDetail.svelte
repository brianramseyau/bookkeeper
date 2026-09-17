<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import { mdiDelete, mdiPencil } from '@mdi/js'
  import { ApiError } from '$lib/api'
  import { listCategories, type Category } from '$lib/api/categories'
  import { listUsers, type UserSummary } from '$lib/api/users'
  import { formatCurrency, monthYearLabel } from '$lib/format'
  import { LIFECYCLE_ACTION_TOASTS, lifecyclePatch, type LifecycleAction } from '$lib/lifecycle'
  import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
  import Card from '$lib/components/Card.svelte'
  import ErrorMessage from '$lib/components/ErrorMessage.svelte'
  import LoadingSkeleton from '$lib/components/app/LoadingSkeleton.svelte'
  import PageHeader from '$lib/components/app/PageHeader.svelte'
  import StatGrid from '$lib/components/app/StatGrid.svelte'
  import StatCard from '$lib/components/app/StatCard.svelte'
  import ActionMenu from '$lib/components/ActionMenu.svelte'
  import MonthlyExpenseChart from '$lib/components/MonthlyExpenseChart.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { outgoingMenuActions, type OutgoingMenuAction } from './menu'
  import OutgoingFormSheet from './OutgoingFormSheet.svelte'
  import OutgoingHistoryEditSheet, {
    type OutgoingHistoryEditValues,
  } from './OutgoingHistoryEditSheet.svelte'
  import type {
    OutgoingAdapter,
    OutgoingFormValues,
    OutgoingHistoryEntry,
    OutgoingRecord,
    OutgoingTrend,
  } from './types'

  interface Props {
    adapter: OutgoingAdapter<OutgoingRecord>
    id: number
    /** A page-specific section below the shared ones (e.g. Utilities' FY grid, Expenses' budget breakdown). Receives the item and a refresh callback for when a change there alters the shared figures. */
    extra?: Snippet<[item: OutgoingRecord, refresh: () => Promise<void>]>
  }

  let { adapter, id, extra }: Props = $props()

  let item = $state<OutgoingRecord | null>(null)
  let trend = $state<OutgoingTrend | null>(null)
  let history = $state<OutgoingHistoryEntry[]>([])
  let categories = $state<Category[]>([])
  let users = $state<UserSummary[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let formOpen = $state(false)

  let historyFormOpen = $state(false)
  let historyFormTarget = $state<OutgoingHistoryEntry | null>(null)
  let historyFormSubmitting = $state(false)
  let historyFormError = $state<string | null>(null)

  const listHref = $derived(`/${adapter.kind}`)

  onMount(load)

  async function load() {
    loading = true
    error = null
    try {
      const [loaded, loadedTrend, categoryList, userList, loadedHistory] = await Promise.all([
        adapter.get(id),
        adapter.trend(id),
        listCategories(),
        listUsers(),
        adapter.history ? adapter.history(id) : Promise.resolve([]),
      ])
      item = loaded
      trend = loadedTrend
      categories = categoryList
      users = userList
      history = loadedHistory
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load'
    } finally {
      loading = false
    }
  }

  async function refresh() {
    if (!item) return
    try {
      const [loaded, loadedTrend, loadedHistory] = await Promise.all([
        adapter.get(id),
        adapter.trend(id),
        adapter.history ? adapter.history(id) : Promise.resolve([]),
      ])
      item = loaded
      trend = loadedTrend
      history = loadedHistory
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to load'
    }
  }

  function menuActions(current: OutgoingRecord) {
    return outgoingMenuActions(adapter.supportsLifecycle ? adapter.state(current) : null, {
      onEdit: () => (formOpen = true),
      onLifecycle: (action) => runLifecycle(current, action),
    })
  }

  async function runLifecycle(current: OutgoingRecord, action: LifecycleAction) {
    error = null
    try {
      if (action === 'delete') {
        const confirmed = await confirmDestructive({
          title: `Delete "${current.name}"?`,
          description: 'This cannot be undone.',
        })
        if (!confirmed) return
        await adapter.remove(current.id)
        toast.success(`${adapter.singular} deleted`)
        await goto(listHref)
        return
      }
      await adapter.setLifecycle(current.id, lifecyclePatch(action))
      toast.success(`${adapter.singular} ${LIFECYCLE_ACTION_TOASTS[action]}`)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : `Failed to ${action}`
    }
  }

  async function submit(values: OutgoingFormValues) {
    if (!item) return
    await adapter.update(item.id, values, item)
    toast.success(`${adapter.singular} updated`)
    formOpen = false
    await refresh()
  }

  async function removeHistory(entry: OutgoingHistoryEntry) {
    const confirmed = await confirmDestructive({
      title: `Delete the ${monthYearLabel(entry.year, entry.month)} payment?`,
      description: 'This cannot be undone.',
    })
    if (!confirmed) return
    try {
      await adapter.deleteHistory?.(entry.id)
      await refresh()
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Failed to delete payment'
    }
  }

  function openEditHistory(entry: OutgoingHistoryEntry) {
    historyFormTarget = entry
    historyFormError = null
    historyFormOpen = true
  }

  async function submitHistory(values: OutgoingHistoryEditValues) {
    if (!historyFormTarget) return
    historyFormSubmitting = true
    historyFormError = null
    try {
      await adapter.updateHistory?.(id, historyFormTarget, values.amount)
      historyFormOpen = false
      toast.success('Payment updated')
      await refresh()
    } catch (err) {
      historyFormError = err instanceof ApiError ? err.message : 'Failed to save changes'
    } finally {
      historyFormSubmitting = false
    }
  }

  function historyMenuActions(entry: OutgoingHistoryEntry): OutgoingMenuAction[] {
    const actions: OutgoingMenuAction[] = []
    if (adapter.updateHistory) {
      actions.push({
        label: 'Edit',
        path: mdiPencil,
        variant: 'neutral' as const,
        onclick: () => openEditHistory(entry),
      })
    }
    actions.push({
      label: 'Delete',
      path: mdiDelete,
      variant: 'danger' as const,
      onclick: () => removeHistory(entry),
    })
    return actions
  }

  const chartData = $derived(
    (trend?.months ?? []).map((month) => ({
      year: month.year,
      month: month.month,
      total: month.amount,
    }))
  )

  const itemMenuActions = $derived(item ? menuActions(item) : [])
</script>

{#if loading}
  <LoadingSkeleton rows={4} />
{:else if !item}
  <ErrorMessage message={error ?? 'Not found.'} />
{:else if item}
  <PageHeader title={item.name} back={{ href: listHref, label: adapter.title }}>
    {#snippet actions()}
      <ActionMenu label={item ? `Actions for ${item.name}` : 'Actions'} actions={itemMenuActions} />
    {/snippet}
  </PageHeader>

  {#if error}
    <div class="mt-4"><ErrorMessage message={error} /></div>
  {/if}

  {#if trend}
    <div class="mt-6">
      <StatGrid cols={4}>
        {#each adapter.stats(item, trend, { categories, users }) as stat (stat.label)}
          <StatCard
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            tone={stat.tone}
            dot={stat.dot}
          />
        {/each}
      </StatGrid>
    </div>
  {/if}

  {#if chartData.length > 0}
    <Card class="mt-6 p-4">
      <h2 class="text-foreground mb-2 text-sm font-medium">Last 12 months</h2>
      <MonthlyExpenseChart data={chartData} ariaLabel="{item.name} over the last 12 months" />
    </Card>
  {/if}

  {#if adapter.hasHistory && history.length > 0}
    <Card class="mt-6 sm:overflow-x-auto">
      <h2 class="text-foreground px-3 pt-3 text-sm font-medium">Payment history</h2>
      <table class="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr class="border-border border-b">
            <th class="text-muted-foreground px-3 py-2 text-left font-medium">Month</th>
            <th class="text-muted-foreground px-3 py-2 text-right font-medium">Amount</th>
            <th class="text-muted-foreground px-3 py-2 text-left font-medium">Status</th>
            <th class="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {#each history as entry (entry.id)}
            <tr class="border-border border-b last:border-0">
              <td class="text-foreground px-3 py-2">{monthYearLabel(entry.year, entry.month)}</td>
              <td class="font-figures text-foreground px-3 py-2 text-right">
                {formatCurrency(entry.amount)}
              </td>
              <td class="px-3 py-2">
                {#if entry.paid}
                  <Badge class="border-in-tint bg-in-tint text-in border">Paid</Badge>
                {:else}
                  <Badge variant="secondary">Unpaid</Badge>
                {/if}
              </td>
              <td class="px-3 py-2 text-right">
                <ActionMenu
                  label="Actions for {monthYearLabel(entry.year, entry.month)}"
                  actions={historyMenuActions(entry)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </Card>
  {/if}

  {#if extra}
    {@render extra(item, refresh)}
  {/if}
{/if}

<OutgoingFormSheet
  open={formOpen}
  onOpenChange={(open) => (formOpen = open)}
  {adapter}
  {categories}
  {users}
  {item}
  onSubmit={submit}
/>

<OutgoingHistoryEditSheet
  open={historyFormOpen}
  onOpenChange={(open) => {
    historyFormOpen = open
    if (!open) historyFormTarget = null
  }}
  entry={historyFormTarget}
  submitting={historyFormSubmitting}
  error={historyFormError}
  onSubmit={submitHistory}
/>
