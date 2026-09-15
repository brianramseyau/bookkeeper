import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { currentFinancialYear, financialYearLabel } from '$lib/format'
import IncomeYearNav from './IncomeYearNav.svelte'

describe('IncomeYearNav', () => {
  it('shows the financial year label', () => {
    render(IncomeYearNav, { financialYear: 2025, onChange: vi.fn() })

    expect(screen.getByText(financialYearLabel(2025))).toBeInTheDocument()
  })

  it('reports the previous and next deltas', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(IncomeYearNav, { financialYear: currentFinancialYear() - 1, onChange })

    await user.click(screen.getByRole('button', { name: '← Prev' }))
    await user.click(screen.getByRole('button', { name: 'Next →' }))

    expect(onChange).toHaveBeenNthCalledWith(1, -1)
    expect(onChange).toHaveBeenNthCalledWith(2, 1)
  })

  it('disables Next at the current financial year', () => {
    render(IncomeYearNav, { financialYear: currentFinancialYear(), onChange: vi.fn() })

    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
  })
})
