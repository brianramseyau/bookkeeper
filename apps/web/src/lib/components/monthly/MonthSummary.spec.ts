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
        actualNet: 4270,
      }),
    })

    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('$4,300.00')).toBeInTheDocument()
    expect(screen.getByText('Outgoing')).toBeInTheDocument()
    expect(screen.getByText('$730.00')).toBeInTheDocument()
    expect(screen.getByText('Net')).toBeInTheDocument()
    const net = screen.getByText('+$4,270.00')
    expect(net).toHaveClass('text-in')
  })

  it('colors Net negative when the month is running at a deficit', () => {
    render(MonthSummary, { data: makeData({ actualNet: -30 }) })

    const net = screen.getByText('-$30.00')
    expect(net).toHaveClass('text-over')
  })
})
