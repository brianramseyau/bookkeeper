import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getIncomeYtd, listIncomeEntries } from '$lib/api/income'
import { getIncomeTaxSetting } from '$lib/api/income_tax_settings'
import { ApiError } from '$lib/api'
import type { UserSummary } from '$lib/api/users'
import { currentFinancialYear } from '$lib/format'
import IncomeChartsSection from './IncomeChartsSection.svelte'

vi.mock('$lib/api/income', () => ({ listIncomeEntries: vi.fn(), getIncomeYtd: vi.fn() }))
vi.mock('$lib/api/income_tax_settings', () => ({ getIncomeTaxSetting: vi.fn() }))

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    userId: 1,
    financialYear: currentFinancialYear(),
    users: [brian],
    sources: [],
    refreshToken: 0,
    ...overrides,
  }
}

describe('IncomeChartsSection', () => {
  beforeEach(() => {
    vi.mocked(listIncomeEntries).mockReset()
    vi.mocked(getIncomeYtd).mockReset()
    vi.mocked(getIncomeTaxSetting).mockReset()
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(getIncomeYtd).mockResolvedValue({
      financialYear: currentFinancialYear(),
      sources: [],
      months: [],
      ytdTotal: 0,
    })
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: null,
    })
  })

  it('defers loading until opened', async () => {
    render(IncomeChartsSection, { props: baseProps() })

    expect(screen.queryByText('Estimated vs actual income')).toBeNull()
    expect(listIncomeEntries).not.toHaveBeenCalled()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Charts/ }))

    expect(await screen.findByText('Estimated vs actual income')).toBeInTheDocument()
    expect(screen.getByText('Year by year')).toBeInTheDocument()
    expect(screen.getByText('Income by person')).toBeInTheDocument()
    expect(screen.getByText('Salary vs other income')).toBeInTheDocument()
    expect(listIncomeEntries).toHaveBeenCalledTimes(1)
  })

  it('shows empty states when there is no income', async () => {
    render(IncomeChartsSection, { props: baseProps() })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Charts/ }))

    expect(await screen.findAllByText('No income logged this year')).toHaveLength(2)
  })

  it('shows an error when chart data fails to load', async () => {
    vi.mocked(listIncomeEntries).mockRejectedValue(new ApiError(500, 'Could not load charts'))
    render(IncomeChartsSection, { props: baseProps() })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Charts/ }))

    expect(await screen.findByText('Could not load charts')).toBeInTheDocument()
  })

  it('refetches when the refresh token changes while open', async () => {
    const { rerender } = render(IncomeChartsSection, { props: baseProps() })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Charts/ }))
    await screen.findByText('Estimated vs actual income')
    expect(listIncomeEntries).toHaveBeenCalledTimes(1)

    await rerender(baseProps({ refreshToken: 1 }))

    expect(await screen.findByText('Estimated vs actual income')).toBeInTheDocument()
    expect(listIncomeEntries).toHaveBeenCalledTimes(2)
  })
})
