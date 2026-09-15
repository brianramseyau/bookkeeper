import { describe, expect, it } from 'vitest'
import type { StandardMonthResult } from './api/standard-month'
import {
  type MonthStripEvent,
  computeRunningBalance,
  dayToX,
  eventsFromStandardMonth,
  layoutTicks,
  scaleBalancePoints,
  todayX,
} from './month-strip'

function makeEvent(overrides: Partial<MonthStripEvent> = {}): MonthStripEvent {
  return {
    key: 'event-1',
    label: 'Rent',
    day: 1,
    amount: 100,
    kind: 'outgoing',
    estimated: false,
    href: null,
    ...overrides,
  }
}

describe('dayToX', () => {
  it('maps day 1 to 0 and the last day to 1', () => {
    expect(dayToX(1, 30)).toBe(0)
    expect(dayToX(30, 30)).toBe(1)
  })

  it('maps a mid-month day proportionally', () => {
    expect(dayToX(16, 31)).toBeCloseTo(0.5, 5)
  })

  it('does not divide by zero for a single-day month', () => {
    expect(dayToX(1, 1)).toBe(0)
  })
})

describe('todayX', () => {
  it('returns the fraction for today when viewing the current month', () => {
    const today = new Date(2026, 8, 16) // 16 Sep 2026 (JS months are 0-indexed)
    expect(todayX(2026, 9, 30, today)).toBeCloseTo(dayToX(16, 30), 5)
  })

  it('returns null when viewing a different month', () => {
    const today = new Date(2026, 8, 16)
    expect(todayX(2026, 10, 31, today)).toBeNull()
  })

  it('returns null when viewing a different year', () => {
    const today = new Date(2026, 8, 16)
    expect(todayX(2025, 9, 30, today)).toBeNull()
  })
})

describe('layoutTicks', () => {
  it('positions each event by day', () => {
    const ticks = layoutTicks(
      [makeEvent({ key: 'a', day: 1 }), makeEvent({ key: 'b', day: 31 })],
      31
    )
    expect(ticks.find((t) => t.key === 'a')?.x).toBe(0)
    expect(ticks.find((t) => t.key === 'b')?.x).toBe(1)
  })

  it('stacks same-kind ticks that fall close together', () => {
    const ticks = layoutTicks(
      [
        makeEvent({ key: 'a', day: 10, kind: 'outgoing' }),
        makeEvent({ key: 'b', day: 11, kind: 'outgoing' }),
        makeEvent({ key: 'c', day: 25, kind: 'outgoing' }),
      ],
      30
    )
    expect(ticks.find((t) => t.key === 'a')?.stack).toBe(0)
    expect(ticks.find((t) => t.key === 'b')?.stack).toBe(1)
    expect(ticks.find((t) => t.key === 'c')?.stack).toBe(0)
  })

  it('breaks a same-day tie deterministically by key', () => {
    const ticks = layoutTicks(
      [makeEvent({ key: 'b', day: 10 }), makeEvent({ key: 'a', day: 10 })],
      30
    )
    expect(ticks.map((t) => t.key)).toEqual(['a', 'b'])
  })

  it('tracks income and outgoing collisions separately', () => {
    const ticks = layoutTicks(
      [
        makeEvent({ key: 'pay', day: 10, kind: 'income' }),
        makeEvent({ key: 'bill', day: 10, kind: 'outgoing' }),
      ],
      30
    )
    expect(ticks.find((t) => t.key === 'pay')?.stack).toBe(0)
    expect(ticks.find((t) => t.key === 'bill')?.stack).toBe(0)
  })
})

describe('computeRunningBalance', () => {
  it('starts at the starting balance and steps through events in day order', () => {
    const points = computeRunningBalance(
      [
        makeEvent({ key: 'bill', day: 15, amount: 50, kind: 'outgoing' }),
        makeEvent({ key: 'pay', day: 5, amount: 200, kind: 'income' }),
      ],
      100,
      30
    )
    expect(points[0]).toMatchObject({ day: 1, balance: 100 })
    expect(points[1]).toMatchObject({ day: 5, balance: 300 })
    expect(points[2]).toMatchObject({ day: 15, balance: 250 })
    expect(points[points.length - 1]).toMatchObject({ day: 30, balance: 250 })
  })

  it('breaks a same-day tie deterministically by key', () => {
    const points = computeRunningBalance(
      [
        makeEvent({ key: 'b', day: 10, amount: 20 }),
        makeEvent({ key: 'a', day: 10, amount: 5, kind: 'income' }),
      ],
      0,
      30
    )
    // 'a' (income, +5) sorts before 'b' (outgoing, -20): 0 -> 5 -> -15.
    expect(points.map((p) => p.balance)).toEqual([0, 5, -15, -15])
  })

  it('does not duplicate the last-day point when an event already lands there', () => {
    const points = computeRunningBalance([makeEvent({ day: 30, amount: 10 })], 0, 30)
    expect(points.filter((p) => p.day === 30)).toHaveLength(1)
  })

  it('with no events, spans day 1 to the last day at a flat balance', () => {
    const points = computeRunningBalance([], 50, 28)
    expect(points).toEqual([
      { day: 1, x: 0, balance: 50 },
      { day: 28, x: 1, balance: 50 },
    ])
  })
})

describe('scaleBalancePoints', () => {
  it('scales balances onto a 0..1 band', () => {
    const scaled = scaleBalancePoints([
      { day: 1, x: 0, balance: 0 },
      { day: 30, x: 1, balance: 100 },
    ])
    expect(scaled[0]!.y).toBe(0)
    expect(scaled[1]!.y).toBe(1)
  })

  it('centres a flat balance instead of dividing by zero', () => {
    const scaled = scaleBalancePoints([
      { day: 1, x: 0, balance: 50 },
      { day: 30, x: 1, balance: 50 },
    ])
    expect(scaled.every((p) => p.y === 0.5)).toBe(true)
  })
})

describe('eventsFromStandardMonth', () => {
  function makeResult(overrides: Partial<StandardMonthResult> = {}): StandardMonthResult {
    return {
      year: 2026,
      month: 9,
      carryover: 500,
      income: { lines: [], projectedTotal: 0, actualTotal: 0 },
      expenses: { lines: [], projectedTotal: 0, actualTotal: 0 },
      projectedNet: 0,
      actualNet: 0,
      ...overrides,
    }
  }

  it('splits an income source projected total evenly across its pay dates', () => {
    const data = makeResult({
      income: {
        lines: [
          {
            key: 'income-source-1',
            label: 'Salary',
            sourceId: 1,
            userId: 1,
            projected: 3000,
            actual: 3000,
            estimated: false,
            payDates: ['2026-09-05T00:00:00.000Z', '2026-09-19T00:00:00.000Z'],
          },
        ],
        projectedTotal: 3000,
        actualTotal: 3000,
      },
    })
    const events = eventsFromStandardMonth(data, 2026, 9)
    expect(events).toHaveLength(2)
    expect(events.every((e) => e.kind === 'income' && e.amount === 1500)).toBe(true)
    expect(events.map((e) => e.day).sort((a, b) => a - b)).toEqual([5, 19])
  })

  it('skips a pay date that rolls into a different month than the one being viewed', () => {
    const data = makeResult({
      income: {
        lines: [
          {
            key: 'income-source-3',
            label: 'Ariel Income',
            sourceId: 3,
            userId: null,
            projected: 2600,
            actual: 2600,
            estimated: false,
            payDates: ['2026-03-18T00:00:00.000Z', '2026-04-01T00:00:00.000Z'],
          },
        ],
        projectedTotal: 2600,
        actualTotal: 2600,
      },
    })
    const events = eventsFromStandardMonth(data, 2026, 3)
    expect(events).toHaveLength(1)
    expect(events[0]?.day).toBe(18)
  })

  it('skips an income source with no pay dates in the month', () => {
    const data = makeResult({
      income: {
        lines: [
          {
            key: 'income-source-2',
            label: 'Bonus',
            sourceId: 2,
            userId: 1,
            projected: 0,
            actual: 0,
            estimated: false,
            payDates: [],
          },
        ],
        projectedTotal: 0,
        actualTotal: 0,
      },
    })
    expect(eventsFromStandardMonth(data, 2026, 9)).toHaveLength(0)
  })

  it('builds an outgoing event from a resolvable due date, preferring actual over projected', () => {
    const data = makeResult({
      expenses: {
        lines: [
          {
            key: 'recurring-bill-1',
            label: 'Internet',
            projected: 80,
            actual: 75,
            dueDay: 12,
            dueDate: null,
            dueDateEstimated: false,
            paid: true,
            estimated: false,
            editable: true,
            receivedOn: null,
          },
        ],
        projectedTotal: 80,
        actualTotal: 75,
      },
    })
    const events = eventsFromStandardMonth(data, 2026, 9)
    expect(events).toEqual([
      {
        key: 'recurring-bill-1',
        label: 'Internet',
        day: 12,
        amount: 75,
        kind: 'outgoing',
        estimated: false,
        href: '/bills/1',
      },
    ])
  })

  it('skips an outgoing line with a resolvable due date but no known amount', () => {
    const data = makeResult({
      expenses: {
        lines: [
          {
            key: 'recurring-bill-2',
            label: 'Gym',
            projected: null,
            actual: null,
            dueDay: 5,
            dueDate: null,
            dueDateEstimated: false,
            paid: false,
            estimated: false,
            editable: true,
            receivedOn: null,
          },
        ],
        projectedTotal: 0,
        actualTotal: 0,
      },
    })
    expect(eventsFromStandardMonth(data, 2026, 9)).toHaveLength(0)
  })

  it('skips an outgoing line with no resolvable due date or amount', () => {
    const data = makeResult({
      expenses: {
        lines: [
          {
            key: 'expense-1',
            label: 'Groceries',
            projected: 200,
            actual: null,
            dueDay: null,
            dueDate: null,
            dueDateEstimated: false,
            paid: false,
            estimated: false,
            editable: true,
            receivedOn: null,
          },
        ],
        projectedTotal: 200,
        actualTotal: 0,
      },
    })
    expect(eventsFromStandardMonth(data, 2026, 9)).toHaveLength(0)
  })

  it('flags an event estimated when its line is assumed or its due date is a guess', () => {
    const data = makeResult({
      expenses: {
        lines: [
          {
            key: 'utility-1',
            label: 'Power',
            projected: 150,
            actual: null,
            dueDay: null,
            dueDate: '2026-09-20T00:00:00.000Z',
            dueDateEstimated: true,
            paid: false,
            estimated: false,
            editable: false,
            receivedOn: null,
          },
        ],
        projectedTotal: 150,
        actualTotal: 0,
      },
    })
    const events = eventsFromStandardMonth(data, 2026, 9)
    expect(events[0]?.estimated).toBe(true)
  })
})
