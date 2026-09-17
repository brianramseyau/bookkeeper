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
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
import UtilityBillsGrid from './UtilityBillsGrid.svelte'

vi.mock('$lib/api/utilities', () => ({
  getUtilityBills: vi.fn(),
  upsertUtilityBill: vi.fn(),
  deleteUtilityBill: vi.fn(),
}))
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
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

// A share of `billedMonth`'s quarterly period landing in the following
// month, which has no bill row of its own - read-only, per `readOnly` in
// UtilityBillsGrid.svelte.
const sharedMonth = {
  year: secondMonth!.year,
  month: secondMonth!.month,
  amount: 30,
  billYear: firstMonth!.year,
  billMonth: firstMonth!.month,
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

  it('adds a bill into an empty month through the form sheet, and refreshes the parent', async () => {
    vi.mocked(utilitiesApi.upsertUtilityBill).mockResolvedValue({
      ...billedMonth,
      id: 22,
      year: secondMonth!.year,
      month: secondMonth!.month,
      amount: 75,
    })
    const { onChanged } = renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(SECOND).closest('tr')!
    await user.click(within(row).getByRole('button', { name: `Actions for the ${SECOND} bill` }))
    await user.click(screen.getByText('Add bill'))
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '75' } })
    await fireEvent.submit(document.querySelector('#utility-bill-form')!)

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
    await user.click(within(row).getByRole('button', { name: `Actions for the ${SECOND} bill` }))
    await user.click(screen.getByText('Add bill'))
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '-1' } })
    await fireEvent.submit(document.querySelector('#utility-bill-form')!)

    expect(await screen.findByText('Enter a valid amount')).toBeInTheDocument()
  })

  it('edits an existing bill through the form sheet', async () => {
    vi.mocked(utilitiesApi.upsertUtilityBill).mockResolvedValue({ ...billedMonth, amount: 95 })
    const { onChanged } = renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(FIR).closest('tr')!
    await user.click(within(row).getByRole('button', { name: `Actions for the ${FIR} bill` }))
    await user.click(screen.getByText('Edit'))
    await fireEvent.input(screen.getByDisplayValue('90'), { target: { value: '95' } })
    await fireEvent.submit(document.querySelector('#utility-bill-form')!)

    await waitFor(() =>
      expect(utilitiesApi.upsertUtilityBill).toHaveBeenCalledWith(
        utility.id,
        firstMonth!.year,
        firstMonth!.month,
        95,
        undefined,
        expect.any(String)
      )
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('closes the bill sheet from the Cancel button without saving', async () => {
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(FIR).closest('tr')!
    await user.click(within(row).getByRole('button', { name: `Actions for the ${FIR} bill` }))
    await user.click(screen.getByText('Edit'))
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()
    expect(utilitiesApi.upsertUtilityBill).not.toHaveBeenCalled()
  })

  it('deletes an existing bill after confirmation', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(true)
    vi.mocked(utilitiesApi.deleteUtilityBill).mockResolvedValue(undefined)
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(FIR).closest('tr')!
    await user.click(within(row).getByRole('button', { name: `Actions for the ${FIR} bill` }))
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(utilitiesApi.deleteUtilityBill).toHaveBeenCalledWith(21))
  })

  it('does not delete a bill when the confirmation is declined', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(false)
    renderGrid()
    await screen.findByText('$90.00')
    const user = userEvent.setup()

    const row = screen.getByText(FIR).closest('tr')!
    await user.click(within(row).getByRole('button', { name: `Actions for the ${FIR} bill` }))
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled())
    expect(utilitiesApi.deleteUtilityBill).not.toHaveBeenCalled()
  })

  it('renders a read-only share month with no actions menu, while the billed month keeps Edit/Delete', async () => {
    vi.mocked(utilitiesApi.getUtilityBills).mockResolvedValue({
      bills: [billedMonth],
      monthlyShares: [sharedMonth],
    })
    renderGrid()
    await screen.findByText('$90.00')

    const shareRow = screen.getByText(SECOND).closest('tr')!
    expect(within(shareRow).getByText('$30.00')).toBeInTheDocument()
    expect(
      within(shareRow).queryByRole('button', { name: `Actions for the ${SECOND} bill` })
    ).not.toBeInTheDocument()

    const billRow = screen.getByText(FIR).closest('tr')!
    expect(
      within(billRow).getByRole('button', { name: `Actions for the ${FIR} bill` })
    ).toBeInTheDocument()
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
