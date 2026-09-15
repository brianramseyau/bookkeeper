import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import type { StandardMonthResult } from '$lib/api/standard-month'
import MonthSummary from './MonthSummary.svelte'

function makeData(overrides: Partial<StandardMonthResult> = {}): StandardMonthResult {
  return {
    year: 2026,
    month: 9,
    carryover: 500,
    income: { lines: [], projectedTotal: 0, actualTotal: 4300 },
    expenses: { lines: [], projectedTotal: 0, actualTotal: 0 },
    projectedNet: 4300,
    actualNet: 4270,
    ...overrides,
  }
}

describe('MonthSummary', () => {
  it('renders the month strip headline', () => {
    render(MonthSummary, { year: 2026, month: 9, data: makeData() })

    expect(screen.getByRole('heading', { name: 'Sep 2026' })).toBeInTheDocument()
  })

  it('shows cash on hand as carryover plus actual income received', () => {
    render(MonthSummary, { year: 2026, month: 9, data: makeData({ carryover: 500 }) })

    expect(screen.getByText('Cash on hand')).toBeInTheDocument()
    expect(screen.getByText('$4,800.00')).toBeInTheDocument()
  })

  it('shows actual net and variance with sign-based tone', () => {
    render(MonthSummary, {
      year: 2026,
      month: 9,
      data: makeData({ actualNet: 4270, projectedNet: 4300 }),
    })

    const actual = screen.getByText('$4,270.00')
    expect(actual).toHaveClass('text-in')
    const variance = screen.getByText('-$30.00')
    expect(variance).toHaveClass('text-over')
  })
})
