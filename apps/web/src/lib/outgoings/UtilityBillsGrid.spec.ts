import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Utility } from '$lib/api/utilities'
import UtilityBillsGrid from './UtilityBillsGrid.svelte'

vi.mock('$lib/api/utilities', () => ({
  getUtilityBills: vi.fn(),
  upsertUtilityBill: vi.fn(),
  deleteUtilityBill: vi.fn(),
}))

import * as utilitiesApi from '$lib/api/utilities'

const utility = {
  id: 3,
  name: 'Water',
  categoryId: null,
  frequency: 'quarterly',
  dueOffsetDays: 14,
  dueOffsetBusinessDaysOnly: false,
  paidInAdvance: false,
  isActive: true,
  createdAt: '',
  updatedAt: '',
} as Utility

const julyBill = {
  id: 21,
  utilityId: 3,
  year: 2026,
  month: 7,
  amount: 90,
  notes: null,
  paid: true,
  receivedOn: '2026-07-20T00:00:00.000Z',
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(utilitiesApi.getUtilityBills).mockResolvedValue({
    bills: [julyBill],
    monthlyShares: [],
  })
})

function renderGrid(onChanged = vi.fn().mockResolvedValue(undefined), overrides = {}) {
  render(UtilityBillsGrid, { props: { utility, onChanged, ...overrides } })
  return { onChanged }
}

describe('UtilityBillsGrid', () => {
  it('renders the financial year and a billed month', async () => {
    renderGrid()

    expect(await screen.findByText('FY 2026-27')).toBeInTheDocument()
    expect(screen.getByText('$90.00')).toBeInTheDocument()
  })

  it('saves a bill into an empty month', async () => {
    vi.mocked(utilitiesApi.upsertUtilityBill).mockResolvedValue(julyBill)
    const { onChanged } = renderGrid()
    await screen.findByText('FY 2026-27')
    const user = userEvent.setup()

    const augustRow = screen.getByText('Aug 2026').closest('tr')!
    await user.click(within(augustRow).getByRole('button', { name: '+' }))
    await fireEvent.input(within(augustRow).getByRole('spinbutton'), { target: { value: '75' } })
    await user.click(within(augustRow).getByRole('button', { name: /Save Aug 2026 bill/ }))

    await waitFor(() =>
      expect(utilitiesApi.upsertUtilityBill).toHaveBeenCalledWith(3, 2026, 8, 75, undefined, null)
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('shows an error for an invalid amount', async () => {
    renderGrid()
    await screen.findByText('FY 2026-27')
    const user = userEvent.setup()

    const augustRow = screen.getByText('Aug 2026').closest('tr')!
    await user.click(within(augustRow).getByRole('button', { name: '+' }))
    await fireEvent.input(within(augustRow).getByRole('spinbutton'), { target: { value: '-1' } })
    await user.click(within(augustRow).getByRole('button', { name: /Save Aug 2026 bill/ }))

    expect(await screen.findByText('Enter a valid amount')).toBeInTheDocument()
  })

  it('deletes an existing bill', async () => {
    vi.mocked(utilitiesApi.deleteUtilityBill).mockResolvedValue(undefined)
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const julyRow = screen.getByText('Jul 2026').closest('tr')!
    await user.click(within(julyRow).getByRole('button', { name: '$90.00' }))
    await user.click(within(julyRow).getByRole('button', { name: /Delete Jul 2026 bill/ }))

    await waitFor(() => expect(utilitiesApi.deleteUtilityBill).toHaveBeenCalledWith(21))
  })

  it('navigates between financial years, disabling Next at the current one', async () => {
    renderGrid()
    await screen.findByText('FY 2026-27')
    const user = userEvent.setup()

    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '← Prev' }))
    expect(screen.getByText('FY 2025-26')).toBeInTheDocument()
  })

  it('explains the billing cadence for a non-monthly utility', async () => {
    renderGrid()
    expect(await screen.findByText(/Paid in arrears/)).toBeInTheDocument()
  })

  it('surfaces a load error', async () => {
    vi.mocked(utilitiesApi.getUtilityBills).mockRejectedValue(new Error('nope'))
    renderGrid()

    expect(await screen.findByText('Failed to load bills')).toBeInTheDocument()
  })
})
