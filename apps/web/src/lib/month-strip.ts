import type { StandardMonthResult } from './api/standard-month'
import { resolveDueDate, actualIsAssumed, viewHref } from './standard-month-line'
import { round2 } from './format'

export interface MonthStripEvent {
  key: string
  label: string
  /** Day of month, 1-indexed. */
  day: number
  amount: number
  kind: 'income' | 'outgoing'
  /** A projected/assumed figure or date rather than a confirmed one - see DESIGN.md's "due" colour. */
  estimated: boolean
  href: string | null
}

export interface MonthStripTick extends MonthStripEvent {
  /** Fraction across the strip, 0 (day 1) to 1 (last day of month). */
  x: number
  /** Vertical slot among same-kind ticks that collide on the x-axis, 0-indexed. */
  stack: number
}

export interface MonthStripBalancePoint {
  day: number
  x: number
  balance: number
}

/** Fraction across the strip for a given day of month - 0 at day 1, 1 at the month's last day. */
export function dayToX(day: number, daysInMonth: number): number {
  if (daysInMonth <= 1) return 0
  return (day - 1) / (daysInMonth - 1)
}

/** Fraction across the strip for "today", or null when the viewed month isn't the current one. */
export function todayX(
  year: number,
  month: number,
  daysInMonth: number,
  today: Date = new Date()
): number | null {
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return null
  return dayToX(today.getDate(), daysInMonth)
}

// Ticks within this fraction of each other are treated as colliding and
// stacked vertically rather than overlapping - roughly a day and a half on
// a 30-day month.
const COLLISION_THRESHOLD = 0.05

/**
 * Positions each event along the strip and assigns income/outgoing ticks
 * that land close together a vertical stack slot, so their labels don't
 * overlap - collisions are tracked separately per kind since income ticks
 * sit above the line and outgoing ticks below it.
 */
export function layoutTicks(events: MonthStripEvent[], daysInMonth: number): MonthStripTick[] {
  const sorted = [...events].sort((a, b) => a.day - b.day || a.key.localeCompare(b.key))
  const placedByKind: Record<MonthStripEvent['kind'], { x: number; stack: number }[]> = {
    income: [],
    outgoing: [],
  }
  return sorted.map((event) => {
    const x = dayToX(event.day, daysInMonth)
    const placed = placedByKind[event.kind]
    // The next free row among this tick's colliding neighbours, not simply
    // how many collide: three ticks each within the threshold of their
    // predecessor (e.g. days 10/11/12) must take rows 0/1/2, or the first
    // and third would land on the same row and overlap.
    const usedRows = new Set(
      placed.filter((p) => Math.abs(p.x - x) < COLLISION_THRESHOLD).map((p) => p.stack)
    )
    let stack = 0
    while (usedRows.has(stack)) stack++
    placed.push({ x, stack })
    return { ...event, x, stack }
  })
}

/**
 * The month's running balance trajectory: starts at `startingBalance` on
 * day 1, and steps up/down at each event's day in chronological order.
 * Always includes an explicit point for day 1 and the month's last day, so
 * the line spans the full strip even when there are no events near either
 * edge.
 */
export function computeRunningBalance(
  events: MonthStripEvent[],
  startingBalance: number,
  daysInMonth: number
): MonthStripBalancePoint[] {
  const sorted = [...events].sort((a, b) => a.day - b.day || a.key.localeCompare(b.key))
  const points: MonthStripBalancePoint[] = [
    { day: 1, x: dayToX(1, daysInMonth), balance: round2(startingBalance) },
  ]
  let balance = startingBalance
  for (const event of sorted) {
    balance += event.kind === 'income' ? event.amount : -event.amount
    points.push({ day: event.day, x: dayToX(event.day, daysInMonth), balance: round2(balance) })
  }
  const last = points[points.length - 1]!
  if (last.day !== daysInMonth) {
    points.push({ day: daysInMonth, x: dayToX(daysInMonth, daysInMonth), balance: last.balance })
  }
  return points
}

/**
 * Scales a set of balance points onto a `0..1` vertical band (0 = bottom,
 * 1 = top) for drawing as an SVG path - a flat balance (or a single point)
 * scales to the vertical centre rather than dividing by zero.
 */
export function scaleBalancePoints(points: MonthStripBalancePoint[]): { x: number; y: number }[] {
  const balances = points.map((p) => p.balance)
  const min = Math.min(...balances)
  const max = Math.max(...balances)
  const range = max - min
  return points.map((p) => ({
    x: p.x,
    y: range === 0 ? 0.5 : (p.balance - min) / range,
  }))
}

// Only returns a day when `isoDate` actually falls within `year`/`month` -
// a pay date can roll into the next month (e.g. weekend-rollback pushing a
// 1st-of-month payday to the previous Friday, or vice versa), and plotting
// that day-of-month figure against the *viewed* month's day scale would
// silently misplace it (e.g. a 1 April payout rendered as day 1 of March).
function dayOfMonthFromIso(isoDate: string, year: number, month: number): number | null {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return null
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month) return null
  return date.getUTCDate()
}

/**
 * Builds the strip's events straight from a `/standard-month` response -
 * one event per income pay date (amount split evenly across the source's
 * pay dates in the month) and one per outgoing line with a resolvable due
 * date, reusing the same date/assumed logic the Monthly table already
 * renders with (`standard-month-line.ts`) so the strip never disagrees
 * with the table below it.
 */
export function eventsFromStandardMonth(
  data: StandardMonthResult,
  year: number,
  month: number
): MonthStripEvent[] {
  const events: MonthStripEvent[] = []

  for (const line of data.income.lines) {
    if (line.payDates.length === 0) continue
    // Prefer the really-logged total (what the Monthly table's Actual column
    // shows) over the projection, same as the outgoing loop below - the
    // strip's own comment promises it never disagrees with the table.
    const amount = line.actual ?? line.projected
    const perPeriod = round2(amount / line.payDates.length)
    for (const date of line.payDates) {
      const day = dayOfMonthFromIso(date, year, month)
      if (day === null) continue
      events.push({
        key: `${line.key}-${date}`,
        label: line.label,
        day,
        amount: perPeriod,
        kind: 'income',
        estimated: line.estimated,
        href: null,
      })
    }
  }

  for (const line of data.expenses.lines) {
    const dueDate = resolveDueDate(line, year, month)
    if (!dueDate) continue
    const day = dayOfMonthFromIso(dueDate, year, month)
    if (day === null) continue
    const amount = line.actual ?? line.projected
    if (amount === null) continue
    events.push({
      key: line.key,
      label: line.label,
      day,
      amount,
      kind: 'outgoing',
      estimated: actualIsAssumed(line) || line.dueDateEstimated,
      href: viewHref(line),
    })
  }

  return events
}
