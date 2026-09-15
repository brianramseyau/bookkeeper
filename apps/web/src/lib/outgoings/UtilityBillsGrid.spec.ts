import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentFinancialYear,
  financialYearLabel,
  financialYearMonths,
  monthYearLabel,
} from '$lib/format'
import type { Utility } from '$lib/api/utilities'
import UtilityBillsGrid from './UtilityBillsGrid.svelte'

vi.mock('$lib/api/utilities', () => ({
  getUtilityBills: vi.fn(),
  upsertUtilityBill: vi.fn(),
  deleteUtilityBill: vi.fn(),
}))

import * as utilitiesApi from '$lib/api/utilities'

// Derive the expected labels from the same helpers the component uses, so
// these assertions don't hardcode a financial year and break on 1 July.
const financialYear = currentFinancialYear()
const [firstMonth, secondMonth] = financialYearMonths(financialYear)
const FIR = monthYearLabel(firstMonth!.year, firstMonth!.month)
const SECOND = monthYearLabel(secondMonth!.year, secondMonth!.month)
const FY_LABEL = financialYearLabel(financialYear)
const PREV_FY_LABEL = financialYearLabel(financialYear - 1)

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

const billedMonth = {
  id: 21,
  utilityId: 3,
  year: firstMonth!.year,
  month: firstMonth!.month,
  amount: 90,
  notes: null,
  paid: true,
  receivedOn: `${firstMonth!.year}-${String(firstMonth!.month).padStart(2, '0')}-20T00:00:00.000Z`,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(utilitiesApi.getUtilityBills).mockResolvedValue({
    bills: [billedMonth],
    monthlyShares: [],
  })
})

function renderGrid(onChanged = vi.fn().mockResolvedValue(undefined)) {
  render(UtilityBillsGrid, { props: { utility, onChanged } })
  return { onChanged }
}

describe('UtilityBillsGrid', () => {
  it('renders the financial year and a billed month', async () => {
    renderGrid()

    expect(await screen.findByText('$90.00')).toBeInTheDocument()
    expect(screen.getByText(FY_LABEL)).toBeInTheDocument()
  })

  it('saves a bill into an empty month and refreshes the parent', async () => {
    vi.mocked(utilitiesApi.upsertUtilityBill).mockResolvedValue(billedMonth)
    const { onChanged } = renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(SECOND).closest('tr')!
    await user.click(within(row).getByRole('button', { name: '+' }))
    await fireEvent.input(within(row).getByRole('spinbutton'), { target: { value: '75' } })
    await user.click(within(row).getByRole('button', { name: `Save ${SECOND} bill` }))

    await waitFor(() =>
      expect(utilitiesApi.upsertUtilityBill).toHaveBeenCalledWith(
        utility.id,
        secondMonth!.year,
        secondMonth!.month,
        75,
        undefined,
        null
      )
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('shows an error for an invalid amount', async () => {
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(SECOND).closest('tr')!
    await user.click(within(row).getByRole('button', { name: '+' }))
    await fireEvent.input(within(row).getByRole('spinbutton'), { target: { value: '-1' } })
    await user.click(within(row).getByRole('button', { name: `Save ${SECOND} bill` }))

    expect(await screen.findByText('Enter a valid amount')).toBeInTheDocument()
  })

  it('deletes an existing bill', async () => {
    vi.mocked(utilitiesApi.deleteUtilityBill).mockResolvedValue(undefined)
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(FIR).closest('tr')!
    await user.click(within(row).getByRole('button', { name: '$90.00' }))
    await user.click(within(row).getByRole('button', { name: `Delete ${FIR} bill` }))

    await waitFor(() => expect(utilitiesApi.deleteUtilityBill).toHaveBeenCalledWith(21))
  })

  it('navigates between financial years, disabling Next at the current one', async () => {
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '← Prev' }))
    expect(screen.getByText(PREV_FY_LABEL)).toBeInTheDocument()
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
