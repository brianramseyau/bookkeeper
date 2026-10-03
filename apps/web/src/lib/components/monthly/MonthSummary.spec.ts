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
  it('shows the Income, Outgoing and Net figures for the month', () => {
    render(MonthSummary, {
      data: makeData({
        income: { lines: [], projectedTotal: 0, actualTotal: 4300 },
        expenses: { lines: [], projectedTotal: 0, actualTotal: 730 },
      }),
    })

    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('$4,300.00')).toBeInTheDocument()
    expect(screen.getByText('Outgoing')).toBeInTheDocument()
    expect(screen.getByText('$730.00')).toBeInTheDocument()
    expect(screen.getByText('Net')).toBeInTheDocument()
    // Income minus Outgoing, not `actualNet` (which also folds in carryover).
    const net = screen.getByText('+$3,570.00')
    expect(net).toHaveClass('text-in')
  })

  it('colors Net negative when Outgoing exceeds Income for the month', () => {
    render(MonthSummary, {
      data: makeData({
        income: { lines: [], projectedTotal: 0, actualTotal: 100 },
        expenses: { lines: [], projectedTotal: 0, actualTotal: 130 },
      }),
    })

    const net = screen.getByText('-$30.00')
    expect(net).toHaveClass('text-over')
  })

  it('does not truncate large figures', () => {
    const { container } = render(MonthSummary, {
      data: makeData({
        income: { lines: [], projectedTotal: 0, actualTotal: 25973.75 },
        expenses: { lines: [], projectedTotal: 0, actualTotal: 25400 },
      }),
    })

    expect(container.querySelector('.truncate')).toBeNull()
  })
})
