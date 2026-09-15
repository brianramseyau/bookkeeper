import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import IncomeYtdSummary from './IncomeYtdSummary.svelte'

describe('IncomeYtdSummary', () => {
  it('renders the total, salary and other figures', () => {
    render(IncomeYtdSummary, { total: 5630, salary: 5000, other: 630 })

    expect(screen.getByText('To date')).toBeInTheDocument()
    expect(screen.getByText('$5,630.00')).toBeInTheDocument()
    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
    expect(screen.getByText('$630.00')).toBeInTheDocument()
  })
})
