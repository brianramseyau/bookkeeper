<script lang="ts">
  import type { StandardMonthResult } from '$lib/api/standard-month'
  import { formatCurrency, monthYearLabel } from '$lib/format'
  import {
    computeRunningBalance,
    eventsFromStandardMonth,
    layoutTicks,
    scaleBalancePoints,
    todayX,
    type MonthStripTick,
  } from '$lib/month-strip'

  interface Props {
    year: number
    month: number
    data: StandardMonthResult
  }

  let { year, month, data }: Props = $props()

  const daysInMonth = $derived(new Date(Date.UTC(year, month, 0)).getUTCDate())
  const events = $derived(eventsFromStandardMonth(data, year, month))
  const incomeTicks = $derived(
    layoutTicks(
      events.filter((e) => e.kind === 'income'),
      daysInMonth
    )
  )
  const outgoingTicks = $derived(
    layoutTicks(
      events.filter((e) => e.kind === 'outgoing'),
      daysInMonth
    )
  )
  const balancePath = $derived(
    buildPath(scaleBalancePoints(computeRunningBalance(events, data.carryover, daysInMonth)))
  )
  const todayFraction = $derived(todayX(year, month, daysInMonth))
  const surplus = $derived(data.projectedNet)

  // A real household's month can easily carry 20-30 outgoing lines (bills,
  // subscriptions, utilities, expenses) - dense enough that this needs a
  // fixed per-day pixel budget rather than always fitting the viewport's
  // width, or same-day ticks crush into unreadable overlap. Below `sm` the
  // strip scrolls horizontally instead (see DESIGN.md's month strip
  // signature element and Phase 4's deviation note).
  const PX_PER_DAY = 28
  const trackWidth = $derived(Math.max(daysInMonth * PX_PER_DAY, 480))

  // Visible stack rows are capped so that density doesn't grow the strip's
  // height without bound - a tick beyond the cap overlaps the last row
  // instead (rare: needs 5+ obligations landing within COLLISION_THRESHOLD
  // of each other) rather than pushing into whatever renders below the
  // strip, which is what made the first pass of this component "awful" -
  // see Phase 4's deviation note.
  const MAX_VISIBLE_STACK = 4
  const ROW_STEP = 20
  const BASE_OFFSET = 14
  const TICK_BLOCK = 28
  const sideHeight = BASE_OFFSET + (MAX_VISIBLE_STACK - 1) * ROW_STEP + TICK_BLOCK
  const stripHeight = sideHeight * 2

  function buildPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return ''
    return points
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * 100).toFixed(2)} ${(72 - p.y * 44).toFixed(2)}`
      )
      .join(' ')
  }

  function tickOffset(t: MonthStripTick): string {
    const visualStack = Math.min(t.stack, MAX_VISIBLE_STACK - 1)
    const distance = BASE_OFFSET + visualStack * ROW_STEP
    return t.kind === 'income'
      ? `bottom: calc(50% + ${distance}px)`
      : `top: calc(50% + ${distance}px)`
  }

  // The strip keeps only a glyph + amount always visible per tick (a full
  // name label per tick doesn't survive real data density - see above);
  // the item's name still reaches sighted mouse users via this native
  // tooltip and everyone else via the link's accessible name below.
  function tickTitle(t: MonthStripTick): string {
    return `${t.label} — ${formatCurrency(t.amount)}${t.estimated ? ' (estimated)' : ''}`
  }
</script>

{#snippet tick(t: MonthStripTick)}
  <span
    aria-hidden="true"
    class={t.estimated ? 'text-due' : t.kind === 'income' ? 'text-in' : 'text-ink'}
  >
    {t.kind === 'income' ? '▲' : '▼'}
  </span>
  <span class="font-figures text-[11px] whitespace-nowrap {t.estimated ? 'text-due' : 'text-ink'}">
    {formatCurrency(t.amount)}
  </span>
{/snippet}

<div class="border-rule bg-surface overflow-hidden rounded-[10px] border p-4 sm:p-6">
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <h2 class="font-display text-ink text-xl sm:text-2xl">{monthYearLabel(year, month)}</h2>
    <p class="flex items-baseline gap-1.5">
      <span class="font-figures text-lg font-semibold {surplus >= 0 ? 'text-in' : 'text-over'}">
        {formatCurrency(Math.abs(surplus))}
      </span>
      <span class="text-muted-foreground text-sm">
        {surplus >= 0 ? 'projected surplus' : 'projected deficit'}
      </span>
    </p>
  </div>

  <!-- `pb-8` (not `pb-2`) so the "Today" caption hanging ~21px below the
       track stays inside this overflow-y-hidden clip region. -->
  <div class="mt-8 overflow-x-auto overflow-y-hidden pb-8">
    <div class="relative" style="height: {stripHeight}px; min-width: {trackWidth}px">
      <!-- Establishes its own containing block, inset from the scroll
           track's true edges, so a tick at day 1 or the month's last day
           (translated -50% to centre its label) never bleeds past the
           card's rounded border. -->
      <div class="absolute inset-x-6 inset-y-0">
        <div class="border-rule absolute inset-x-0 top-1/2 border-t" aria-hidden="true"></div>

        <svg
          class="pointer-events-none absolute inset-0 h-full w-full opacity-40"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={balancePath}
            fill="none"
            stroke="currentColor"
            stroke-width="0.6"
            vector-effect="non-scaling-stroke"
            class="text-ink motion-safe:[animation:month-strip-draw_900ms_ease-out_forwards] motion-safe:[stroke-dasharray:300] motion-safe:[stroke-dashoffset:300]"
          />
        </svg>

        {#if todayFraction !== null}
          <div
            class="border-muted-foreground/50 absolute inset-y-0 border-l border-dashed"
            style="left: {todayFraction * 100}%"
            aria-hidden="true"
          >
            <span
              class="text-muted-foreground absolute bottom-[-1.35rem] left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap"
              >Today</span
            >
          </div>
        {/if}

        {#each [...incomeTicks, ...outgoingTicks] as t (t.key)}
          {#if t.href}
            <a
              href={t.href}
              title={tickTitle(t)}
              aria-label={tickTitle(t)}
              class="focus-visible:ring-violet absolute flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-sm text-center outline-none focus-visible:ring-2"
              style="left: {t.x * 100}%; {tickOffset(t)}"
            >
              {@render tick(t)}
            </a>
          {:else}
            <div
              title={tickTitle(t)}
              class="absolute flex -translate-x-1/2 flex-col items-center gap-0.5 text-center"
              style="left: {t.x * 100}%; {tickOffset(t)}"
            >
              {@render tick(t)}
              <!-- `aria-label` isn't exposed on this roleless <div>, so the
                   name has to be real (visually hidden) content. -->
              <span class="sr-only">{tickTitle(t)}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  @keyframes month-strip-draw {
    to {
      stroke-dashoffset: 0;
    }
  }
</style>
