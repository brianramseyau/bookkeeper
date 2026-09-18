<script lang="ts">
  import { onMount } from 'svelte'
  import type { StandardMonthLine, StandardMonthIncomeLine } from '$lib/api/standard-month'
  import type { IncomeEntry } from '$lib/api/income'
  import type { UserSummary } from '$lib/api/users'
  import type { IncomeRow } from '$lib/income-rows'
  import { entryRowLabel } from '$lib/income-rows'
  import type { UnifiedListItem } from '$lib/monthly-unified-list'
  import { formatCurrency, formatDate, daysUntil } from '$lib/format'
  import {
    dueLabel,
    dueTitle,
    dueChipClass,
    canTrackPaid,
    actualIsAssumed,
    paidTooltip,
    viewHref,
  } from '$lib/standard-month-line'
  import Card from '$lib/components/Card.svelte'
  import IconActionButton from '$lib/components/IconActionButton.svelte'
  import HelpTooltip from '$lib/components/HelpTooltip.svelte'
  import { mdiPencil, mdiCheckBold, mdiDelete } from '@mdi/js'

  interface Props {
    year: number
    month: number
    items: UnifiedListItem[]
    users: UserSummary[]
    savingPaidKey: string | null
    acceptingPlaceholderKey: string | null
    onStartEdit: (line: StandardMonthLine) => void
    onTogglePaid: (line: StandardMonthLine, paid: boolean) => void
    onEditEntry: (entry: IncomeEntry) => void
    onDeleteEntry: (entry: IncomeEntry) => void
    onEditPlaceholder: (
      line: StandardMonthIncomeLine,
      row: Extract<IncomeRow, { type: 'placeholder' }>
    ) => void
    onAcceptPlaceholder: (
      line: StandardMonthIncomeLine,
      row: Extract<IncomeRow, { type: 'placeholder' }>
    ) => void
  }

  let {
    year,
    month,
    items,
    users,
    savingPaidKey,
    acceptingPlaceholderKey,
    onStartEdit,
    onTogglePaid,
    onEditEntry,
    onDeleteEntry,
    onEditPlaceholder,
    onAcceptPlaceholder,
  }: Props = $props()

  function ownerName(userId: number | null): string {
    return userId !== null ? (users.find((u) => u.id === userId)?.fullName ?? '—') : '—'
  }

  function isToday(date: string | null): boolean {
    return date !== null && daysUntil(date) === 0
  }

  // The first item that's today or in the future, among the dated items -
  // items with no resolvable date always sort last (see
  // monthly-unified-list.ts), so "today" can never fall after them; if
  // every dated item is already in the past, the divider sits right before
  // that undated tail instead.
  const todayIndex = $derived.by(() => {
    const firstUndated = items.findIndex((i) => i.date === null)
    const boundary = firstUndated === -1 ? items.length : firstUndated
    for (let i = 0; i < boundary; i++) {
      const date = items[i]!.date
      if (date && daysUntil(date) >= 0) return i
    }
    return boundary
  })

  let todayDivider = $state<HTMLLIElement | null>(null)

  onMount(() => {
    if (!todayDivider) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    todayDivider.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  })
</script>

{#snippet touchAction(
  variant: 'neutral' | 'danger' | 'success',
  label: string,
  path: string,
  onclick: () => void,
  disabled = false
)}
  <IconActionButton {variant} {label} {path} {onclick} {disabled} class="size-11" />
{/snippet}

<Card class="mt-3">
  <ul class="divide-border divide-y px-1 sm:px-2">
    {#each items as item, i (item.key)}
      {#if i === todayIndex}
        <li bind:this={todayDivider} class="flex items-center gap-3 py-2" aria-hidden="true">
          <span class="border-primary/40 h-px flex-1 border-t border-dashed"></span>
          <span class="text-muted-foreground text-xs font-medium">Today</span>
          <span class="border-primary/40 h-px flex-1 border-t border-dashed"></span>
        </li>
      {/if}

      {#if item.type === 'outgoing'}
        {@const line = item.line}
        {@const editable =
          (line.key.startsWith('utility-') && line.editable) ||
          line.key.startsWith('recurring-bill-') ||
          line.key.startsWith('subscription-') ||
          line.key.startsWith('expense-')}
        {@const chipClass = dueChipClass(line, year, month)}
        <li
          class={[
            'flex min-h-11 items-center gap-2 py-2',
            isToday(item.date) && 'bg-in-tint -mx-1 rounded-lg px-1 sm:-mx-2 sm:px-2',
          ]}
        >
          <label
            class="hover:bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg"
          >
            <input
              type="checkbox"
              checked={line.paid}
              disabled={savingPaidKey === line.key || !canTrackPaid(line, year, month)}
              onchange={(e) => onTogglePaid(line, e.currentTarget.checked)}
              aria-label="Paid: {line.label}"
              title={paidTooltip(line, year, month)}
              class={[
                'border-input size-4 rounded disabled:cursor-not-allowed disabled:opacity-40',
                line.estimated ? 'accent-due' : 'accent-violet',
              ]}
            />
          </label>
          <div class="min-w-0 flex-1">
            <p class="text-foreground truncate font-medium">
              {#if viewHref(line)}
                <a href={viewHref(line)} class="hover:text-primary hover:underline">
                  {line.label}
                </a>
              {:else}
                {line.label}
              {/if}
            </p>
            <p class="text-xs" title={dueTitle(line, year, month)}>
              {#if chipClass}
                <span class={['rounded-full px-2 py-0.5 font-medium', chipClass]}
                  >{dueLabel(line, year, month)}</span
                >
              {:else if line.dueDateEstimated}
                <span class="text-muted-foreground"
                  >{dueLabel(line, year, month)}<span class="ml-1">(est.)</span></span
                >
              {:else}
                <span class="text-muted-foreground">{dueLabel(line, year, month)}</span>
              {/if}
            </p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-0.5 text-right">
            <span class="font-figures">
              <span class={[actualIsAssumed(line) && 'text-due font-medium italic']}>
                {formatCurrency(line.actual)}
              </span>
              {#if actualIsAssumed(line)}
                <HelpTooltip
                  label="Why is {line.label}'s actual amount estimated?"
                  text="No record for this month this far back - showing today's live amount, not necessarily what was actually charged then."
                />
              {/if}
            </span>
            <span class="text-muted-foreground font-figures text-xs"
              >Projected {formatCurrency(line.projected)}</span
            >
          </div>
          {#if editable}
            {@render touchAction('neutral', `Edit ${line.label}`, mdiPencil, () =>
              onStartEdit(line)
            )}
          {:else}
            <div class="size-11 shrink-0"></div>
          {/if}
        </li>
      {:else if item.row.type === 'actual'}
        {@const entry = item.row.entry}
        {@const label = entryRowLabel(entry)}
        <li
          class={[
            'flex min-h-11 items-center gap-2 py-2',
            isToday(item.date) && 'bg-in-tint -mx-1 rounded-lg px-1 sm:-mx-2 sm:px-2',
          ]}
        >
          <div class="flex size-11 shrink-0 items-center justify-center">
            <svg viewBox="0 0 24 24" class="text-in size-5" fill="currentColor" aria-hidden="true">
              <path d={mdiCheckBold} />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-foreground truncate font-medium">{item.line.label}</p>
            <p class="text-muted-foreground truncate text-xs">
              <span>{formatDate(entry.receivedOn)}</span>
              {#if entry.incomeSourceId === null}
                · <span>{ownerName(entry.userId)}</span>
              {/if}
              {#if entry.note}
                · <span>{entry.note}</span>
              {/if}
            </p>
          </div>
          <span class="font-figures text-in shrink-0">{formatCurrency(entry.amount)}</span>
          {@render touchAction('neutral', `Edit ${label}`, mdiPencil, () => onEditEntry(entry))}
          {@render touchAction('danger', `Delete ${label}`, mdiDelete, () => onDeleteEntry(entry))}
        </li>
      {:else}
        {@const row = item.row}
        <li
          class={[
            'flex min-h-11 items-center gap-2 py-2 italic',
            isToday(item.date) && 'bg-in-tint -mx-1 rounded-lg px-1 sm:-mx-2 sm:px-2',
          ]}
        >
          <div class="size-11 shrink-0"></div>
          <div class="text-muted-foreground min-w-0 flex-1">
            <p class="truncate font-medium">{item.line.label}</p>
            <p class="truncate text-xs">Not yet logged</p>
          </div>
          <div class="text-muted-foreground flex shrink-0 flex-col items-end gap-0.5 text-right">
            <span class="font-figures">{formatCurrency(row.projected)}</span>
            <span class="text-xs">{formatDate(row.date)}</span>
          </div>
          <div class="not-italic">
            {@render touchAction(
              'success',
              `Accept projected pay for ${formatDate(row.date)}`,
              mdiCheckBold,
              () => onAcceptPlaceholder(item.line, row),
              acceptingPlaceholderKey === row.key
            )}
          </div>
          <div class="not-italic">
            {@render touchAction(
              'neutral',
              `Edit projected pay for ${formatDate(row.date)}`,
              mdiPencil,
              () => onEditPlaceholder(item.line, row)
            )}
          </div>
        </li>
      {/if}
    {/each}
  </ul>
</Card>
