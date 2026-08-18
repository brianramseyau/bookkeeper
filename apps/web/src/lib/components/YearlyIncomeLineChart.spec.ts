import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import YearlyIncomeLineChart from './YearlyIncomeLineChart.svelte'

describe('YearlyIncomeLineChart', () => {
  const series = [
    {
      label: 'FY 2024-25',
      color: '#f59e0b',
      points: [
        { month: 7, total: 4000 },
        { month: 8, total: 9000 },
        { month: 9, total: 14000 },
      ],
    },
    {
      label: 'FY 2025-26',
      color: '#4f46e5',
      points: [{ month: 7, total: 5000 }],
    },
  ]

  it('renders a multi-year cumulative line chart with a legend', () => {
    render(YearlyIncomeLineChart, { series })

    expect(
      screen.getByRole('img', { name: 'Cumulative income by financial year' })
    ).toBeInTheDocument()
    expect(screen.getByText('FY 2024-25')).toBeInTheDocument()
    expect(screen.getByText('FY 2025-26')).toBeInTheDocument()
    expect(screen.getByText('Jul')).toBeInTheDocument()
    expect(screen.getByText('Jun')).toBeInTheDocument()
  })

  it('renders the empty state when no series have points', () => {
    render(YearlyIncomeLineChart, {
      series: [{ label: 'FY 2026-27', color: '#4f46e5', points: [] }],
    })

    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
