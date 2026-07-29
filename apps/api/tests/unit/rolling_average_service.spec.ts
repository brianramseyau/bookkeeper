import { test } from '@japa/runner'
import { RollingAverageService } from '#services/rolling_average_service'

test.group('RollingAverageService', () => {
  test('returns nulls and an empty window for no entries', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([])

    assert.deepEqual(result, {
      average: null,
      latestAmount: null,
      latestYear: null,
      latestMonth: null,
      trend: null,
      months: [],
    })
  })

  test('a single entry has no trend but does have an average', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([{ year: 2026, month: 2, amount: 100 }])

    assert.equal(result.average, 100)
    assert.equal(result.latestAmount, 100)
    assert.equal(result.latestYear, 2026)
    assert.equal(result.latestMonth, 2)
    assert.isNull(result.trend)
    assert.lengthOf(result.months, 1)
  })

  test('sorts out-of-order entries chronologically before computing', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([
      { year: 2026, month: 3, amount: 300 },
      { year: 2026, month: 1, amount: 100 },
      { year: 2026, month: 2, amount: 200 },
    ])

    assert.deepEqual(
      result.months.map((m) => m.month),
      [1, 2, 3]
    )
    assert.equal(result.latestMonth, 3)
    assert.equal(result.latestAmount, 300)
  })

  test('reports an "up" trend when the latest amount exceeds the prior average', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([
      { year: 2026, month: 1, amount: 100 },
      { year: 2026, month: 2, amount: 100 },
      { year: 2026, month: 3, amount: 200 },
    ])

    assert.equal(result.trend, 'up')
  })

  test('reports a "down" trend when the latest amount is below the prior average', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([
      { year: 2026, month: 1, amount: 200 },
      { year: 2026, month: 2, amount: 200 },
      { year: 2026, month: 3, amount: 100 },
    ])

    assert.equal(result.trend, 'down')
  })

  test('reports a "flat" trend when the latest amount equals the prior average', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([
      { year: 2026, month: 1, amount: 100 },
      { year: 2026, month: 2, amount: 100 },
      { year: 2026, month: 3, amount: 100 },
    ])

    assert.equal(result.trend, 'flat')
  })

  test('only considers the trailing 12 months when more entries are given', ({ assert }) => {
    const service = new RollingAverageService()
    // 14 sequential months starting 2025-01; the oldest 2 (amount 1000) fall
    // outside the trailing-12 window and should be dropped.
    const entries = Array.from({ length: 14 }, (_, i) => ({
      year: 2025 + Math.floor(i / 12),
      month: (i % 12) + 1,
      amount: i < 2 ? 1000 : 100,
    }))

    const result = service.computeTrend(entries)

    assert.lengthOf(result.months, 12)
    assert.isFalse(result.months.some((m) => m.amount === 1000))
  })

  test('rounds the average to 2 decimal places', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([
      { year: 2026, month: 1, amount: 100 },
      { year: 2026, month: 2, amount: 100.005 },
      { year: 2026, month: 3, amount: 100.01 },
    ])

    assert.equal(result.average, 100.01)
  })

  test('gaps in billed months are simply absent entries, not zero-amount months', ({ assert }) => {
    const service = new RollingAverageService()

    const result = service.computeTrend([
      { year: 2026, month: 1, amount: 100 },
      { year: 2026, month: 3, amount: 100 },
    ])

    assert.equal(result.average, 100)
    assert.lengthOf(result.months, 2)
  })

  test('merges entries that land on the same calendar month instead of counting it twice', ({
    assert,
  }) => {
    const service = new RollingAverageService()
    // e.g. two overlapping quarterly bills whose expanded shares both cover
    // April - a real month should only ever appear once in the window.
    const result = service.computeTrend([
      { year: 2025, month: 4, amount: 100 },
      { year: 2025, month: 4, amount: 50 },
      { year: 2025, month: 5, amount: 100 },
    ])

    assert.lengthOf(result.months, 2)
    const april = result.months.find((m) => m.month === 4)
    assert.equal(april?.amount, 150)
    assert.equal(result.average, 125)
  })
})
