import { beforeEach, describe, expect, it, vi } from 'vitest'
import { monthState } from './month.svelte'

describe('month store', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    monthState.year = 2026
    monthState.month = 3
  })

  it('reports the current month when the shared value matches today', () => {
    expect(monthState.isCurrentMonth).toBe(true)

    monthState.month = 4
    expect(monthState.isCurrentMonth).toBe(false)
  })

  it('steps forward and back a month, rolling the year', () => {
    monthState.year = 2026
    monthState.month = 12
    monthState.changeMonth(1)
    expect(monthState.year).toBe(2027)
    expect(monthState.month).toBe(1)

    monthState.changeMonth(-1)
    expect(monthState.year).toBe(2026)
    expect(monthState.month).toBe(12)
  })

  it('resets to the current month', () => {
    monthState.year = 2020
    monthState.month = 1
    monthState.goToCurrentMonth()
    expect(monthState.year).toBe(2026)
    expect(monthState.month).toBe(3)
  })

  it('adopts a valid year/month from a URL query string', () => {
    monthState.syncFromUrl('?year=2025&month=11')
    expect(monthState.year).toBe(2025)
    expect(monthState.month).toBe(11)
  })

  it('leaves the shared value untouched for a URL with no params', () => {
    monthState.year = 2024
    monthState.month = 6
    monthState.syncFromUrl('')
    expect(monthState.year).toBe(2024)
    expect(monthState.month).toBe(6)
  })

  it('ignores an out-of-range or non-numeric month, and a non-positive year', () => {
    monthState.syncFromUrl('?year=2025&month=13')
    monthState.syncFromUrl('?year=0&month=5')
    monthState.syncFromUrl('?year=2025&month=abc')

    expect(monthState.year).toBe(2026)
    expect(monthState.month).toBe(3)
  })

  it('requires both a valid year and month before adopting the URL', () => {
    monthState.syncFromUrl('?month=11')
    expect(monthState.month).toBe(3)
  })
})
