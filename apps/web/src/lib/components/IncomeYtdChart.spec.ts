import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import IncomeYtdChart from './IncomeYtdChart.svelte'

describe('IncomeYtdChart', () => {
  const data = [
    { year: 2025, month: 7, actual: 4000, projected: 5000 },
    { year: 2025, month: 8, actual: 0, projected: 5000 },
    { year: 2025, month: 9, actual: 5100, projected: 5000 },
  ]

  it('renders an actual vs estimated bar chart with a legend', () => {
    render(IncomeYtdChart, { data })

    expect(
      screen.getByRole('img', { name: 'Estimated vs actual income by month' })
    ).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('Estimated')).toBeInTheDocument()
    expect(screen.getByText('Jul')).toBeInTheDocument()
    expect(screen.getByText('Sep')).toBeInTheDocument()
  })

  it('renders the empty state without data', () => {
    render(IncomeYtdChart, { data: [] })

    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
