import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import type { StandardMonthResult } from '$lib/api/standard-month'
import MonthStrip from './MonthStrip.svelte'

function makeData(overrides: Partial<StandardMonthResult> = {}): StandardMonthResult {
  return {
    year: 2026,
    month: 9,
    carryover: 500,
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
          payDates: ['2026-09-05T00:00:00.000Z'],
        },
      ],
      projectedTotal: 3000,
      actualTotal: 3000,
    },
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
    projectedNet: 2920,
    actualNet: 2925,
    ...overrides,
  }
}

describe('MonthStrip', () => {
  it('renders the viewed month and year as its headline', () => {
    render(MonthStrip, { year: 2026, month: 9, data: makeData() })

    expect(screen.getByRole('heading', { name: 'Sep 2026' })).toBeInTheDocument()
  })

  it('shows a positive-toned projected surplus for a positive net', () => {
    render(MonthStrip, { year: 2026, month: 9, data: makeData({ projectedNet: 2920 }) })

    expect(screen.getByText('$2,920.00')).toHaveClass('text-in')
    expect(screen.getByText('projected surplus')).toBeInTheDocument()
  })

  it('shows a negative-toned projected deficit for a negative net, as an absolute amount', () => {
    render(MonthStrip, { year: 2026, month: 9, data: makeData({ projectedNet: -150 }) })

    expect(screen.getByText('$150.00')).toHaveClass('text-over')
    expect(screen.getByText('projected deficit')).toBeInTheDocument()
  })

  it('renders an income tick with its amount and a native tooltip naming the source', () => {
    render(MonthStrip, { year: 2026, month: 9, data: makeData() })

    expect(screen.getByText('$3,000.00')).toBeInTheDocument()
    expect(screen.getByTitle('Salary — $3,000.00')).toBeInTheDocument()
  })

  it('renders an outgoing tick linked to its detail page, named via its accessible name', () => {
    render(MonthStrip, { year: 2026, month: 9, data: makeData() })

    const link = screen.getByRole('link', { name: 'Internet — $75.00' })
    expect(link).toHaveAttribute('href', '/bills/1')
    expect(screen.getByText('$75.00')).toBeInTheDocument()
  })

  it('does not render a today marker for a year far from the present', () => {
    render(MonthStrip, { year: 1999, month: 1, data: makeData({ year: 1999, month: 1 }) })

    expect(screen.queryByText('Today')).toBeNull()
  })
})
