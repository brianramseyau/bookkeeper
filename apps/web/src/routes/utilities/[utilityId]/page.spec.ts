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
import { currentFinancialYear, financialYearLabel, monthYearLabel } from '$lib/format'
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
  paidInAdvance: false,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}

// All fixture months fall Jan-Apr, which share the same calendar year as
// the financial year's *ending* year - so a single year value covers them,
// and the page's default-selected FY (the current one) shows this data with
// no Prev/Next navigation needed.
const fixtureFyEndYear = currentFinancialYear()

// A quarterly bill of $300 entered in April that also covers Feb and Mar as
// computed, read-only monthly shares of $100 each.
const aprilBill = {
  id: 10,
  utilityId: 1,
  year: fixtureFyEndYear,
  month: 4,
  amount: 300,
  notes: null,
  paid: false,
  createdAt: '',
  updatedAt: '',
}
const billsResponse: UtilityBillsResponse = {
  bills: [aprilBill],
  monthlyShares: [
    { year: fixtureFyEndYear, month: 2, amount: 100, billYear: fixtureFyEndYear, billMonth: 4 },
    { year: fixtureFyEndYear, month: 3, amount: 100, billYear: fixtureFyEndYear, billMonth: 4 },
    { year: fixtureFyEndYear, month: 4, amount: 100, billYear: fixtureFyEndYear, billMonth: 4 },
  ],
}
const emptyBillsResponse: UtilityBillsResponse = { bills: [], monthlyShares: [] }

// A second quarterly bill entered a month after the April one (May instead
// of July) - their periods overlap on Mar and Apr, exactly the kind of
// off-cadence duplicate/overlapping entry the warning icon is meant to
// catch. Mirrors real data found in production (see the Water utility).
const mayBill = {
  id: 11,
  utilityId: 1,
  year: fixtureFyEndYear,
  month: 5,
  amount: 300,
  notes: null,
  paid: false,
  createdAt: '',
  updatedAt: '',
}
const overlappingBillsResponse: UtilityBillsResponse = {
  bills: [aprilBill, mayBill],
  monthlyShares: [
    { year: fixtureFyEndYear, month: 2, amount: 100, billYear: fixtureFyEndYear, billMonth: 4 },
    { year: fixtureFyEndYear, month: 3, amount: 100, billYear: fixtureFyEndYear, billMonth: 4 },
    { year: fixtureFyEndYear, month: 4, amount: 100, billYear: fixtureFyEndYear, billMonth: 4 },
    { year: fixtureFyEndYear, month: 3, amount: 100, billYear: fixtureFyEndYear, billMonth: 5 },
    { year: fixtureFyEndYear, month: 4, amount: 100, billYear: fixtureFyEndYear, billMonth: 5 },
    { year: fixtureFyEndYear, month: 5, amount: 100, billYear: fixtureFyEndYear, billMonth: 5 },
  ],
}

const upTrend: UtilityTrend = {
  average: 120,
  latestAmount: 130,
  latestYear: fixtureFyEndYear,
  latestMonth: 4,
  trend: 'up',
  months: [{ year: fixtureFyEndYear, month: 4, amount: 130 }],
  nextDueOn: null,
}
const emptyTrend: UtilityTrend = {
  average: null,
  latestAmount: null,
  latestYear: null,
  latestMonth: null,
  trend: null,
  months: [],
  nextDueOn: null,
}

function setDefaultMocks() {
  vi.mocked(listUtilities).mockResolvedValue([electricity])
  vi.mocked(getUtilityBills).mockResolvedValue(billsResponse)
  vi.mocked(getUtilityTrend).mockResolvedValue(upTrend)
}

/** The lone Amount cell (2nd column) of the row for a given year/month. */
function getCell(container: HTMLElement, year: number, month: number): HTMLElement {
  const row = within(container)
    .getByText(monthYearLabel(year, month), { selector: 'td' })
    .closest('tr')!
  return row.cells[1] as HTMLElement
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
    expect(screen.getByText(/paid in arrears/)).toBeInTheDocument()
    expect(screen.getByText(/due on day 14 of the billing month/)).toBeInTheDocument()
    expect(screen.getByText(/Click the month it's actually billed in/)).toBeInTheDocument()
    expect(screen.getByText(/billing month is the/)).toBeInTheDocument()
    expect(screen.getByText('last')).toBeInTheDocument()
  })

  it('shows "paid in advance" and the first-month hint for a paid-in-advance utility', async () => {
    vi.mocked(listUtilities).mockResolvedValue([{ ...electricity, paidInAdvance: true }])
    vi.mocked(getUtilityBills).mockResolvedValue(billsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(upTrend)
    render(UtilityDetailPage)

    await screen.findByRole('heading', { name: 'Electricity' })
    expect(screen.getByText(/paid in advance/)).toBeInTheDocument()
    expect(screen.getByText('first')).toBeInTheDocument()
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

  it('shows the configured due day for an offset of 1', async () => {
    vi.mocked(listUtilities).mockResolvedValue([{ ...electricity, dueOffsetDays: 1 }])
    vi.mocked(getUtilityBills).mockResolvedValue(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(emptyTrend)
    render(UtilityDetailPage)

    expect(await screen.findByText(/due on day 1 of the billing month/)).toBeInTheDocument()
  })

  it('shows a read-only, italicized computed share for a non-billing month', async () => {
    setDefaultMocks()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const febCell = getCell(container, fixtureFyEndYear, 2)
    expect(within(febCell).getByText('$100.00')).toBeInTheDocument()
    expect(within(febCell).queryByRole('button')).toBeNull()
    const span = within(febCell).getByText('$100.00')
    expect(span.getAttribute('title')).toBe(
      `Part of the ${monthYearLabel(fixtureFyEndYear, 4)} bill`
    )
    expect(span.className).toContain('italic')
  })

  it('shows the billed month with the even share and the real total noted underneath', async () => {
    setDefaultMocks()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, fixtureFyEndYear, 4)
    expect(within(aprCell).getByText('$100.00')).toBeInTheDocument()
    expect(within(aprCell).getByText('bills $300.00')).toBeInTheDocument()
    expect(within(aprCell).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it("warns when a computed share overlaps a second bill's period, without a bill of its own", async () => {
    vi.mocked(listUtilities).mockResolvedValue([electricity])
    vi.mocked(getUtilityBills).mockResolvedValue(overlappingBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(upTrend)
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const marCell = getCell(container, fixtureFyEndYear, 3)
    expect(within(marCell).getByText('$100.00')).toBeInTheDocument()
    const warning = within(marCell).getByTitle(
      `Also covered by the ${monthYearLabel(fixtureFyEndYear, 5)} bill - check for a duplicate or overlapping entry`
    )
    expect(warning).toBeInTheDocument()
  })

  it("warns on a billed month that also overlaps a second bill's period", async () => {
    vi.mocked(listUtilities).mockResolvedValue([electricity])
    vi.mocked(getUtilityBills).mockResolvedValue(overlappingBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(upTrend)
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, fixtureFyEndYear, 4)
    expect(within(aprCell).getByText('bills $300.00')).toBeInTheDocument()
    const warning = within(aprCell).getByTitle(
      `Also covered by the ${monthYearLabel(fixtureFyEndYear, 5)} bill - check for a duplicate or overlapping entry`
    )
    expect(warning).toBeInTheDocument()
  })

  it('does not warn on a month covered by only one bill', async () => {
    vi.mocked(listUtilities).mockResolvedValue([electricity])
    vi.mocked(getUtilityBills).mockResolvedValue(overlappingBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValue(upTrend)
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const mayCell = getCell(container, fixtureFyEndYear, 5)
    expect(within(mayCell).getByText('bills $300.00')).toBeInTheDocument()
    expect(within(mayCell).queryByText('⚠')).toBeNull()
  })

  it('shows a "+" for an empty month with no bill or share', async () => {
    setDefaultMocks()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, fixtureFyEndYear, 1)
    expect(within(janCell).getByRole('button', { name: '+' })).toBeInTheDocument()
  })

  it('adds a bill amount to an empty cell and refreshes bills and trend', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockResolvedValue({
      id: 20,
      utilityId: 1,
      year: fixtureFyEndYear,
      month: 1,
      amount: 75.5,
      notes: null,
      paid: false,
      createdAt: '',
      updatedAt: '',
    })
    const updatedBills: UtilityBillsResponse = {
      bills: [
        aprilBill,
        {
          id: 20,
          utilityId: 1,
          year: fixtureFyEndYear,
          month: 1,
          amount: 75.5,
          notes: null,
          paid: false,
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

    const janCell = getCell(container, fixtureFyEndYear, 1)
    await user.click(within(janCell).getByRole('button', { name: '+' }))
    const input = within(janCell).getByRole('spinbutton')
    await user.type(input, '75.5')
    await user.keyboard('{Enter}')

    expect(upsertUtilityBill).toHaveBeenCalledWith(1, fixtureFyEndYear, 1, 75.5)
    await waitFor(() => expect(getUtilityBills).toHaveBeenCalledTimes(2))
    expect(await within(janCell).findByText('$75.50')).toBeInTheDocument()
  })

  it('cancels editing an empty cell on Escape without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, fixtureFyEndYear, 1)
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

    const janCell = getCell(container, fixtureFyEndYear, 1)
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

    const janCell = getCell(container, fixtureFyEndYear, 1)
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

    const aprCell = getCell(container, fixtureFyEndYear, 4)
    await user.click(within(aprCell).getByText('$100.00'))
    const input = within(aprCell).getByRole('spinbutton')
    expect(input).toHaveValue(300)

    await user.clear(input)
    await user.type(input, '350')
    await user.keyboard('{Enter}')

    expect(upsertUtilityBill).toHaveBeenCalledWith(1, fixtureFyEndYear, 4, 350)
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

    const aprCell = getCell(container, fixtureFyEndYear, 4)
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

    const aprCell = getCell(container, fixtureFyEndYear, 4)
    await user.click(within(aprCell).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Could not delete')).toBeInTheDocument()
  })

  it('removes a billed cell from within edit mode, without triggering a save first', async () => {
    setDefaultMocks()
    vi.mocked(deleteUtilityBill).mockResolvedValue(undefined)
    vi.mocked(getUtilityBills)
      .mockResolvedValueOnce(billsResponse)
      .mockResolvedValueOnce(emptyBillsResponse)
    vi.mocked(getUtilityTrend).mockResolvedValueOnce(upTrend).mockResolvedValueOnce(emptyTrend)
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const aprCell = getCell(container, fixtureFyEndYear, 4)
    await user.click(within(aprCell).getByText('$100.00'))
    expect(within(aprCell).getByRole('spinbutton')).toBeInTheDocument()

    await user.click(within(aprCell).getByRole('button', { name: 'Remove' }))

    expect(deleteUtilityBill).toHaveBeenCalledWith(10)
    expect(upsertUtilityBill).not.toHaveBeenCalled()
    await waitFor(() => expect(getUtilityBills).toHaveBeenCalledTimes(2))
    expect(within(aprCell).queryByRole('spinbutton')).toBeNull()
  })

  it('does not show a Remove button while editing an empty cell with no bill yet', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    const { container } = render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    const janCell = getCell(container, fixtureFyEndYear, 1)
    await user.click(within(janCell).getByRole('button', { name: '+' }))

    expect(within(janCell).queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('shows a single financial year at a time, navigable with Prev/Next, with Next disabled at the current FY', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(UtilityDetailPage)
    await screen.findByRole('heading', { name: 'Electricity' })

    expect(screen.getByText(financialYearLabel(fixtureFyEndYear))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
    // Only 12 rows are shown - one financial year, not an ever-growing set of year columns.
    expect(screen.getAllByRole('row')).toHaveLength(13)

    await user.click(screen.getByRole('button', { name: '← Prev' }))

    expect(screen.getByText(financialYearLabel(fixtureFyEndYear - 1))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next →' })).not.toBeDisabled()
    // No API refetch is needed to change the visible FY - all bills were
    // already loaded once and are simply resliced client-side.
    expect(getUtilityBills).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Next →' }))

    expect(screen.getByText(financialYearLabel(fixtureFyEndYear))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
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
    const offsetInput = screen.getByLabelText('Due (day of the billing month)')
    await user.clear(offsetInput)
    await user.type(offsetInput, '30')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateUtility).toHaveBeenCalledWith(1, {
        frequency: 'annual',
        dueOffsetDays: 30,
        paidInAdvance: false,
      })
    )
    expect(await screen.findByText('annual')).toBeInTheDocument()
  })

  it('edits billing settings and saves paidInAdvance when the checkbox is checked', async () => {
    setDefaultMocks()
    vi.mocked(updateUtility).mockResolvedValue({ ...electricity, paidInAdvance: true })
    const user = userEvent.setup()
    render(UtilityDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByLabelText('Paid in advance / Pre-paid'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateUtility).toHaveBeenCalledWith(1, {
        frequency: 'quarterly',
        dueOffsetDays: 14,
        paidInAdvance: true,
      })
    )
    expect(await screen.findByText(/paid in advance/)).toBeInTheDocument()
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
