import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteUtilityBill,
  getUtilityBills,
  getUtilityTrend,
  listUtilities,
  updateUtility,
  upsertUtilityBill,
  type Utility,
  type UtilityBillsResponse,
  type UtilityTrend,
} from '$lib/api/utilities'
import { ApiError } from '$lib/api'
import UtilityDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { utilityId: '1' } } }))
vi.mock('$lib/api/utilities', () => ({
  listUtilities: vi.fn(),
  getUtilityBills: vi.fn(),
  getUtilityTrend: vi.fn(),
  upsertUtilityBill: vi.fn(),
  deleteUtilityBill: vi.fn(),
  updateUtility: vi.fn(),
}))

const electricity: Utility = {
  id: 1,
  name: 'Electricity',
  categoryId: null,
  frequency: 'quarterly',
  dueOffsetDays: 14,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}

// A quarterly bill of $300 entered in April 2020 that also covers Feb and
// Mar 2020 as computed, read-only monthly shares of $100 each.
const aprilBill = {
  id: 10,
  utilityId: 1,
  year: 2020,
  month: 4,
  amount: 300,
  notes: null,
  createdAt: '',
  updatedAt: '',
}
const billsResponse: UtilityBillsResponse = {
  bills: [aprilBill],
  monthlyShares: [
    { year: 2020, month: 2, amount: 100, billYear: 2020, billMonth: 4 },
    { year: 2020, month: 3, amount: 100, billYear: 2020, billMonth: 4 },
    { year: 2020, month: 4, amount: 100, billYear: 2020, billMonth: 4 },
  ],
}
const emptyBillsResponse: UtilityBillsResponse = { bills: [], monthlyShares: [] }

const upTrend: UtilityTrend = {
  average: 120,
  latestAmount: 130,
  latestYear: 2020,
  latestMonth: 4,
  trend: 'up',
  months: [{ year: 2020, month: 4, amount: 130 }],
}
const emptyTrend: UtilityTrend = {
  average: null,
  latestAmount: null,
  latestYear: null,
  latestMonth: null,
  trend: null,
  months: [],
}

function setDefaultMocks() {
  vi.mocked(listUtilities).mockResolvedValue([electricity])
  vi.mocked(getUtilityBills).mockResolvedValue(billsResponse)
  vi.mocked(getUtilityTrend).mockResolvedValue(upTrend)
}

/** Index (matching <td> position) of a year's column, derived from the header row. */
function yearColumnIndex(container: HTMLElement, year: number): number {
  const headerCells = Array.from(container.querySelectorAll('thead th'))
  const index = headerCells.findIndex((th) => th.textContent === String(year))
  if (index === -1) throw new Error(`No column header found for year ${year}`)
  return index
}

function getCell(container: HTMLElement, monthAbbrev: string, year: number): HTMLElement {
  const row = within(container).getByText(monthAbbrev, { selector: 'td' }).closest('tr')!
  const colIndex = yearColumnIndex(container, year)
  return row.cells[colIndex] as HTMLElement
}

describe('utility detail page', () => {
  beforeEach(() => {
    vi.mocked(listUtilities).mockReset()
    vi.mocked(getUtilityBills).mockReset()
    vi.mocked(getUtilityTrend).mockReset()
    vi.mocked(upsertUtilityBill).mockReset()
    vi.mocked(deleteUtilityBill).mockReset()
    vi.mocked(updateUtility).mockReset()
  })

  it('shows a loading state, then falls back to "Utility not found." after a failed load', async () => {
    // The template only ever renders `error` inside the branch where
    // `utility` is non-null, so a failed load - which leaves `utility` at
    // its initial `null` - surfaces as "Utility not found." rather than the
    // caught error message.
    vi.mocked(listUtilities).mockRejectedValue(new ApiError(500, 'Could not load utility'))
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Utility not found.')).toBeInTheDocument()
  })

  it('falls back to "Utility not found." for a non-API load failure too', async () => {
    vi.mocked(listUtilities).mockRejectedValue(new Error('boom'))
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)
    expect(await screen.findByText('Utility not found.')).toBeInTheDocument()
  })

  it('shows "Utility not found." when no utility matches the route id', async () => {
    vi.mocked(listUtilities).mockResolvedValue([{ ...electricity, id: 2 }])
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)

    expect(await screen.findByText('Utility not found.')).toBeInTheDocument()
    expect(screen.queryByText('Electricity')).toBeNull()
  })

  it('renders the utility name and hides the trend summary when there is no data yet', async () => {
    vi.mocked(listUtilities).mockResolvedValue([electricity])
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)

    expect(await screen.findByRole('heading', { name: 'Electricity' })).toBeInTheDocument()
    expect(screen.queryByText('Latest')).toBeNull()
  })

  it.each([
    ['up', '▲ up'],
    ['down', '▼ down'],
    ['flat', '— flat'],
  ] as const)(
    'shows the %s trend indicator with latest and average figures',
    async (trend, label) => {
      vi.mocked(listUtilities).mockResolvedValue([electricity])
      vi.mocked(getUtilityBills).mockResolvedValue(billsResponse)
      vi.mocked(getUtilityTrend).mockResolvedValue({ ...upTrend, trend })
      render(UtilityDetailPage)

      expect(await screen.findByText(label)).toBeInTheDocument()
      expect(screen.getByText('$130.00')).toBeInTheDocument()
      expect(screen.getByText('$120.00')).toBeInTheDocument()
    }
  )

  it('shows the billing frequency, due-date offset, and quarterly billing hint', async () => {
    setDefaultMocks()
    render(UtilityDetailPage)

    await screen.findByRole('heading', { name: 'Electricity' })
    expect(screen.getByText('quarterly')).toBeInTheDocument()
    expect(screen.getByText(/due 14 days after billing period ends/)).toBeInTheDocument()
    expect(screen.getByText(/Click the month it's actually billed in/)).toBeInTheDocument()
  })

  it('shows no due-offset text and no billing hint for a monthly utility with no offset', async () => {
    vi.mocked(listUtilities).mockResolvedValue([
      { ...electricity, frequency: 'monthly', dueOffsetDays: null },
    ])
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)

    await screen.findByRole('heading', { name: 'Electricity' })
    expect(screen.getByText(/no due-date offset set/)).toBeInTheDocument()
    expect(screen.queryByText(/Click the month it's actually billed in/)).toBeNull()
  })

  it('shows a singular "day" for a due-date offset of 1', async () => {
    vi.mocked(listUtilities).mockResolvedValue([{ ...electricity, dueOffsetDays: 1 }])
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)

    expect(await screen.findByText(/due 1 day after billing period ends/)).toBeInTheDocument()
  })

  it('shows a read-only, italicized computed share for a non-billing month', async () => {
    setDefaultMocks()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const febCell = getCell(container, 'Feb', 2020)
    expect(within(febCell).getByText('$100.00')).toBeInTheDocument()
    expect(within(febCell).queryByRole('button')).toBeNull()
    const span = within(febCell).getByText('$100.00')
    expect(span.getAttribute('title')).toBe('Part of the Apr 2020 bill')
    expect(span.className).toContain('italic')
  })

  it('shows the billed month with the even share and the real total noted underneath', async () => {
    setDefaultMocks()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, 'Apr', 2020)
    expect(within(aprCell).getByText('$100.00')).toBeInTheDocument()
    expect(within(aprCell).getByText('bills $300.00')).toBeInTheDocument()
    expect(within(aprCell).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('shows a "+" for an empty month with no bill or share', async () => {
    setDefaultMocks()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, 'Jan', 2020)
    expect(within(janCell).getByRole('button', { name: '+' })).toBeInTheDocument()
  })

  it('adds a bill amount to an empty cell and refreshes bills and trend', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockResolvedValue({
      id: 20,
      utilityId: 1,
      year: 2020,
      month: 1,
      amount: 75.5,
      notes: null,
      createdAt: '',
      updatedAt: '',
    })
    const updatedBills: UtilityBillsResponse = {
      bills: [
        aprilBill,
        {
          id: 20,
          utilityId: 1,
          year: 2020,
          month: 1,
          amount: 75.5,
          notes: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      monthlyShares: billsResponse.monthlyShares,
    }
    vi.mocked(getUtilityBills)
      .mockResolvedValueOnce(billsResponse)
      .mockResolvedValueOnce(updatedBills)
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, 'Jan', 2020)
    await user.click(within(janCell).getByRole('button', { name: '+' }))
    const input = within(janCell).getByRole('spinbutton')
    await user.type(input, '75.5')
    await user.keyboard('{Enter}')

    expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2020, 1, 75.5)
    await waitFor(() => expect(getUtilityBills).toHaveBeenCalledTimes(2))
    expect(await within(janCell).findByText('$75.50')).toBeInTheDocument()
  })

  it('cancels editing an empty cell on Escape without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, 'Jan', 2020)
    await user.click(within(janCell).getByRole('button', { name: '+' }))
    await user.type(within(janCell).getByRole('spinbutton'), '50')
    await user.keyboard('{Escape}')

    expect(upsertUtilityBill).not.toHaveBeenCalled()
    expect(within(janCell).getByRole('button', { name: '+' })).toBeInTheDocument()
  })

  it('shows an error and keeps editing open for a negative amount', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, 'Jan', 2020)
    await user.click(within(janCell).getByRole('button', { name: '+' }))
    await user.type(within(janCell).getByRole('spinbutton'), '-5')
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Enter a valid amount')).toBeInTheDocument()
    expect(upsertUtilityBill).not.toHaveBeenCalled()
    expect(within(janCell).getByRole('spinbutton')).toBeInTheDocument()
  })

  it('shows an API error when saving a cell fails, leaving the edit open', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockRejectedValue(new ApiError(500, 'Could not save'))
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, 'Jan', 2020)
    await user.click(within(janCell).getByRole('button', { name: '+' }))
    await user.type(within(janCell).getByRole('spinbutton'), '50')
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
    expect(within(janCell).getByRole('spinbutton')).toBeInTheDocument()
  })

  it('edits an existing billed cell, pre-filling the real bill amount (not the evened share)', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockResolvedValue({ ...aprilBill, amount: 350 })
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, 'Apr', 2020)
    await user.click(within(aprCell).getByText('$100.00'))
    const input = within(aprCell).getByRole('spinbutton')
    expect(input).toHaveValue(300)

    await user.clear(input)
    await user.type(input, '350')
    await user.keyboard('{Enter}')

    expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2020, 4, 350)
  })

  it('deletes a billed cell and refreshes bills and trend', async () => {
    setDefaultMocks()
    vi.mocked(deleteUtilityBill).mockResolvedValue(undefined)
    vi.mocked(getUtilityBills)
      .mockResolvedValueOnce(billsResponse)
      .mockResolvedValueOnce(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValueOnce(upTrend).mockResolvedValueOnce(emptyTrend)
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, 'Apr', 2020)
    await user.click(within(aprCell).getByRole('button', { name: 'Remove' }))

    expect(deleteUtilityBill).toHaveBeenCalledWith(10)
    await waitFor(() => expect(getUtilityBills).toHaveBeenCalledTimes(2))
  })

  it('shows an error when deleting a cell fails', async () => {
    setDefaultMocks()
    vi.mocked(deleteUtilityBill).mockRejectedValue(new ApiError(500, 'Could not delete'))
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, 'Apr', 2020)
    await user.click(within(aprCell).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Could not delete')).toBeInTheDocument()
  })

  it('adds a new year column and updates the "Add" button label', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const currentYear = new Date().getFullYear()
    const addButton = screen.getByRole('button', { name: `+ Add ${currentYear + 1}` })
    await user.click(addButton)

    expect(yearColumnIndex(container, currentYear + 1)).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: `+ Add ${currentYear + 2}` })).toBeInTheDocument()
  })

  it('edits billing settings and saves the new frequency and due-date offset', async () => {
    setDefaultMocks()
    vi.mocked(updateUtility).mockResolvedValue({
      ...electricity,
      frequency: 'annual',
      dueOffsetDays: 30,
    })
    const user = userEvent.setup()
    render(UtilityDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.selectOptions(screen.getByLabelText('Frequency'), 'annual')
    const offsetInput = screen.getByLabelText('Due (days after billing period ends)')
    await user.clear(offsetInput)
    await user.type(offsetInput, '30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateUtility).toHaveBeenCalledWith(1, { frequency: 'annual', dueOffsetDays: 30 })
    )
    expect(await screen.findByText('annual')).toBeInTheDocument()
  })

  it('cancels editing billing settings without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(UtilityDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Frequency')).toBeNull()
    expect(updateUtility).not.toHaveBeenCalled()
  })

  it('shows an API error when saving billing settings fails', async () => {
    setDefaultMocks()
    vi.mocked(updateUtility).mockRejectedValue(new ApiError(500, 'Could not save billing settings'))
    const user = userEvent.setup()
    render(UtilityDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save billing settings')).toBeInTheDocument()
  })

  it('links back to the utilities list', async () => {
    setDefaultMocks()
    render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const link = screen.getByRole('link', { name: /Utilities/ })
    expect(link.getAttribute('href')).toBe('/utilities')
  })
})
