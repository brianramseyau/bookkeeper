import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createIncomeSource,
  deleteIncomeSource,
  getIncomeSourcesSummary,
  getIncomeYtd,
  listIncomeSources,
  updateIncomeSource,
  listIncomeEntries,
  listIncomeEntriesForFinancialYear,
  createIncomeEntry,
  updateIncomeEntry,
  deleteIncomeEntry,
  type IncomeSource,
  type IncomeSourceSummary,
  type IncomeYtd,
  type IncomeEntry,
} from '$lib/api/income'
import { getIncomeTaxSetting, setIncomeTaxSetting } from '$lib/api/income_tax_settings'
import { listUsers, type UserSummary } from '$lib/api/users'
import { ApiError } from '$lib/api'
import { currentFinancialYear, financialYearLabel } from '$lib/format'
import IncomePage from './+page.svelte'

vi.mock('$lib/api/income', () => ({
  listIncomeSources: vi.fn(),
  createIncomeSource: vi.fn(),
  updateIncomeSource: vi.fn(),
  deleteIncomeSource: vi.fn(),
  getIncomeSourcesSummary: vi.fn(),
  getIncomeYtd: vi.fn(),
  listIncomeEntries: vi.fn(),
  listIncomeEntriesForFinancialYear: vi.fn(),
  createIncomeEntry: vi.fn(),
  updateIncomeEntry: vi.fn(),
  deleteIncomeEntry: vi.fn(),
}))
vi.mock('$lib/api/income_tax_settings', () => ({
  getIncomeTaxSetting: vi.fn(),
  setIncomeTaxSetting: vi.fn(),
}))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn() }))

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}
const ariel: UserSummary = {
  id: 2,
  fullName: 'Ariel',
  email: 'ariel@example.com',
  displayColor: null,
  initials: 'A',
}

const brianSalary: IncomeSource = {
  id: 1,
  userId: 1,
  name: 'Brian Income',
  expectedAmount: 5000,
  frequency: 'monthly',
  payDayOfMonth: 14,
  weekendRollback: true,
  anchorDate: null,
  taxWithheld: true,
  isActive: true,
  notes: null,
}
const arielWages: IncomeSource = {
  id: 2,
  userId: 2,
  name: 'Ariel Income',
  expectedAmount: 2607.82,
  frequency: 'fortnightly',
  payDayOfMonth: null,
  weekendRollback: false,
  anchorDate: '2026-07-22T00:00:00.000+00:00',
  taxWithheld: true,
  isActive: true,
  notes: null,
}

const summaries: IncomeSourceSummary[] = [
  { userId: 1, fullName: 'Brian', total: 5000, count: 1 },
  { userId: 2, fullName: 'Ariel', total: 5650.6, count: 1 },
]

const emptyYtd: IncomeYtd = { financialYear: 2026, sources: [], months: [], ytdTotal: 0 }

const januaryYtd: IncomeYtd = {
  financialYear: 2026,
  sources: [{ id: 1, name: 'Brian Income' }],
  months: [{ year: 2026, month: 1, bySource: { 1: 5000 }, total: 5000, estimated: false }],
  ytdTotal: 5000,
}

const janEntry: IncomeEntry = {
  id: 10,
  incomeSourceId: 1,
  userId: null,
  year: 2026,
  month: 1,
  receivedOn: '2026-01-14T00:00:00.000+00:00',
  amount: 5000,
  note: 'Payslip',
  taxWithheld: null,
}

const noTaxSetting = { userId: 1, financialYear: 2026, marginalRate: null }

function setDefaultMocks() {
  vi.mocked(listUsers).mockResolvedValue([brian, ariel])
  vi.mocked(listIncomeSources).mockResolvedValue([brianSalary, arielWages])
  vi.mocked(getIncomeSourcesSummary).mockResolvedValue(summaries)
  vi.mocked(getIncomeYtd).mockResolvedValue(emptyYtd)
  vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([])
  vi.mocked(getIncomeTaxSetting).mockResolvedValue(noTaxSetting)
}

describe('income page', () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockReset()
    vi.mocked(listIncomeSources).mockReset()
    vi.mocked(getIncomeSourcesSummary).mockReset()
    vi.mocked(getIncomeYtd).mockReset()
    vi.mocked(createIncomeSource).mockReset()
    vi.mocked(updateIncomeSource).mockReset()
    vi.mocked(deleteIncomeSource).mockReset()
    vi.mocked(listIncomeEntries).mockReset()
    vi.mocked(listIncomeEntriesForFinancialYear).mockReset()
    vi.mocked(createIncomeEntry).mockReset()
    vi.mocked(updateIncomeEntry).mockReset()
    vi.mocked(deleteIncomeEntry).mockReset()
    vi.mocked(getIncomeTaxSetting).mockReset()
    vi.mocked(setIncomeTaxSetting).mockReset()
  })

  it('shows a loading state, then an API error on failure', async () => {
    vi.mocked(listUsers).mockRejectedValue(new ApiError(500, 'Could not load users'))
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(getIncomeSourcesSummary).mockResolvedValue([])
    render(IncomePage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Could not load users')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(listUsers).mockRejectedValue(new Error('boom'))
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(getIncomeSourcesSummary).mockResolvedValue([])
    render(IncomePage)
    expect(await screen.findByText('Failed to load income sources')).toBeInTheDocument()
  })

  it('selects the first user by default and shows per-user summary tiles', async () => {
    setDefaultMocks()
    render(IncomePage)

    expect(await screen.findByText('$5,000.00/mo · 1 source')).toBeInTheDocument()
    expect(screen.getByText('$5,650.60/mo · 1 source')).toBeInTheDocument()
    expect(screen.getByText('Brian Income')).toBeInTheDocument()
    expect(screen.queryByText('Ariel Income')).toBeNull()
  })

  it('shows the cadence label for a monthly source with weekend rollback', async () => {
    setDefaultMocks()
    render(IncomePage)
    expect(await screen.findByText('Monthly, day 14 (or preceding Fri)')).toBeInTheDocument()
  })

  it('shows the cadence label for a fortnightly source with an anchor date', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByText('Ariel'))
    expect(await screen.findByText('Fortnightly (from 2026-07-22)')).toBeInTheDocument()
  })

  it('shows "No income sources yet." when a user has none', async () => {
    vi.mocked(listUsers).mockResolvedValue([brian])
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(getIncomeSourcesSummary).mockResolvedValue([])
    vi.mocked(getIncomeYtd).mockResolvedValue(emptyYtd)
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([])
    vi.mocked(getIncomeTaxSetting).mockResolvedValue(noTaxSetting)
    render(IncomePage)

    expect(await screen.findByText('No income sources yet.')).toBeInTheDocument()
  })

  it('requires a name and expected amount to add a source', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Add income source' }))

    expect(await screen.findByText('Name and expected amount are required')).toBeInTheDocument()
    expect(createIncomeSource).not.toHaveBeenCalled()
  })

  it('requires a pay day for a monthly source', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.type(await screen.findByPlaceholderText('e.g. Salary'), 'Bonus')
    const amountInputs = screen.getAllByRole('spinbutton')
    await user.type(amountInputs[0]!, '100')
    await user.click(screen.getByRole('button', { name: 'Add income source' }))

    expect(
      await screen.findByText('Pay day of month is required for a monthly source')
    ).toBeInTheDocument()
    expect(createIncomeSource).not.toHaveBeenCalled()
  })

  it('requires an anchor date for a fortnightly source', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.type(await screen.findByPlaceholderText('e.g. Salary'), 'Side gig')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '100')
    await user.selectOptions(screen.getByLabelText('Frequency'), 'fortnightly')
    await user.click(screen.getByRole('button', { name: 'Add income source' }))

    expect(
      await screen.findByText('An anchor pay date is required for a fortnightly source')
    ).toBeInTheDocument()
    expect(createIncomeSource).not.toHaveBeenCalled()
  })

  it('adds a monthly income source and reloads the list', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeSource).mockResolvedValue(brianSalary)
    const user = userEvent.setup()
    render(IncomePage)

    await user.type(await screen.findByPlaceholderText('e.g. Salary'), 'Bonus')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '250')
    await user.type(screen.getByLabelText('Pay day'), '1')
    await user.click(screen.getByRole('button', { name: 'Add income source' }))

    await waitFor(() =>
      expect(createIncomeSource).toHaveBeenCalledWith({
        userId: 1,
        name: 'Bonus',
        expectedAmount: 250,
        frequency: 'monthly',
        payDayOfMonth: 1,
        weekendRollback: false,
        anchorDate: undefined,
        taxWithheld: true,
      })
    )
    expect(listIncomeSources).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when adding a source fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeSource).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.type(await screen.findByPlaceholderText('e.g. Salary'), 'Bonus')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '250')
    await user.type(screen.getByLabelText('Pay day'), '1')
    await user.click(screen.getByRole('button', { name: 'Add income source' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('deletes a source and refreshes the summary', async () => {
    setDefaultMocks()
    vi.mocked(deleteIncomeSource).mockResolvedValue(undefined)
    vi.mocked(getIncomeSourcesSummary)
      .mockResolvedValueOnce(summaries)
      .mockResolvedValueOnce([
        { userId: 1, fullName: 'Brian', total: 0, count: 0 },
        { userId: 2, fullName: 'Ariel', total: 5650.6, count: 1 },
      ])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Delete Brian Income' }))[0]!)

    expect(deleteIncomeSource).toHaveBeenCalledWith(1)
    expect(await screen.findByText('$0.00/mo · 0 sources')).toBeInTheDocument()
  })

  it('edits a source: switching cadence, saving, and reloading', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeSource).mockResolvedValue(brianSalary)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    const nameInput = screen.getByDisplayValue('Brian Income')
    await user.clear(nameInput)
    await user.type(nameInput, 'Brian Salary')
    await user.click(screen.getAllByRole('button', { name: 'Save Brian Income' })[0]!)

    await waitFor(() =>
      expect(updateIncomeSource).toHaveBeenCalledWith(1, {
        name: 'Brian Salary',
        expectedAmount: 5000,
        frequency: 'monthly',
        payDayOfMonth: 14,
        weekendRollback: true,
        anchorDate: null,
        taxWithheld: true,
      })
    )
    expect(listIncomeSources).toHaveBeenCalledTimes(2)
  })

  it('cancels an edit without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Cancel editing Brian Income' })[0]!)

    expect(screen.queryByDisplayValue('Brian Income')).toBeNull()
    expect(updateIncomeSource).not.toHaveBeenCalled()
  })

  it('shows a validation error when editing to a blank name', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    await user.clear(screen.getByDisplayValue('Brian Income'))
    await user.click(screen.getAllByRole('button', { name: 'Save Brian Income' })[0]!)

    expect(await screen.findByText('Name and expected amount are required')).toBeInTheDocument()
    expect(updateIncomeSource).not.toHaveBeenCalled()
  })

  it('shows an API error when saving an edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeSource).mockRejectedValue(new ApiError(500, 'Could not save'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Save Brian Income' })[0]!)

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
  })

  it('shows the year-to-date table with source columns, an estimated tag, and a running total', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue({
      financialYear: 2026,
      sources: [{ id: 1, name: 'Brian Income' }],
      months: [
        { year: 2026, month: 1, bySource: { 1: 5000 }, total: 5000, estimated: false },
        { year: 2026, month: 2, bySource: { 1: 5000 }, total: 5000, estimated: true },
      ],
      ytdTotal: 10000,
    })
    render(IncomePage)

    const table = await screen
      .findByText('Year to date')
      .then(() => screen.getAllByRole('table')[1]!)
    expect(within(table).getByText('(est.)')).toBeInTheDocument()
    expect(within(table).getAllByText('$10,000.00').length).toBeGreaterThan(0)
  })

  it('shows a "no data" message when the YTD table is empty', async () => {
    setDefaultMocks()
    render(IncomePage)
    expect(
      await screen.findByText(`No data yet for ${financialYearLabel(currentFinancialYear())}.`)
    ).toBeInTheDocument()
  })

  it('navigates to the previous year and reloads YTD, disabling Next at the current financial year', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)
    await screen.findByText('Brian Income')

    const thisFinancialYear = currentFinancialYear()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '← Prev' }))

    expect(screen.getAllByText(financialYearLabel(thisFinancialYear - 1)).length).toBeGreaterThan(0)
    await waitFor(() => expect(getIncomeYtd).toHaveBeenLastCalledWith(1, thisFinancialYear - 1))
    expect(screen.getByRole('button', { name: 'Next →' })).not.toBeDisabled()
  })

  it('shows an API error when loading YTD fails', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockRejectedValue(new ApiError(500, 'Could not load YTD'))
    render(IncomePage)
    expect(await screen.findByText('Could not load YTD')).toBeInTheDocument()
  })

  it('expands a month row and loads its income entries', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))

    expect(listIncomeEntries).toHaveBeenCalledWith(2026, 1)
    expect(await screen.findByText('Payslip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log income' })).toBeInTheDocument()
  })

  it('filters out entries whose source belongs to another user', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([
      janEntry,
      { ...janEntry, id: 11, incomeSourceId: 2, note: 'Ariel entry' },
    ])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))

    expect(await screen.findByText('Payslip')).toBeInTheDocument()
    expect(screen.queryByText('Ariel entry')).toBeNull()
  })

  it('collapses an expanded month on a second click', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    const user = userEvent.setup()
    render(IncomePage)

    const toggle = await screen.findByRole('button', { name: 'Jan 2026' })
    await user.click(toggle)
    await screen.findByText('Payslip')
    await user.click(toggle)

    expect(screen.queryByText('Payslip')).toBeNull()
  })

  it('shows a "no entries" message for an expanded month with nothing logged', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))

    expect(await screen.findByText('No entries logged for Jan 2026.')).toBeInTheDocument()
  })

  it('shows an API error when loading a month’s entries fails', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockRejectedValue(new ApiError(500, 'Could not load entries'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))

    expect(await screen.findByText('Could not load entries')).toBeInTheDocument()
  })

  it('requires a source and amount to log an entry', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('No entries logged for Jan 2026.')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('Source and amount are required')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('logs a new income entry for the expanded month and reloads', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(createIncomeEntry).mockResolvedValue(janEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('No entries logged for Jan 2026.')
    await user.type(screen.getByRole('spinbutton', { name: 'Amount' }), '5000')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: 1,
        year: 2026,
        month: 1,
        amount: 5000,
        receivedOn: null,
        note: null,
      })
    )
    expect(listIncomeEntries).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when logging an entry fails', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(createIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not log income'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('No entries logged for Jan 2026.')
    await user.type(screen.getByRole('spinbutton', { name: 'Amount' }), '5000')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('Could not log income')).toBeInTheDocument()
  })

  it('edits an income entry inline and cancels without saving', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Cancel editing income entry' })[0]!)

    expect(screen.queryByDisplayValue('5000')).toBeNull()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('saves an edited income entry and reloads', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    vi.mocked(updateIncomeEntry).mockResolvedValue(janEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    const amountInput = screen.getByDisplayValue('5000')
    await user.clear(amountInput)
    await user.type(amountInput, '5200')
    await user.click(screen.getAllByRole('button', { name: 'Save income entry' })[0]!)

    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(10, {
        amount: 5200,
        receivedOn: '2026-01-14',
        note: 'Payslip',
      })
    )
    expect(listIncomeEntries).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when saving an entry edit fails', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    vi.mocked(updateIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not save entry'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    await user.click(screen.getAllByRole('button', { name: 'Save income entry' })[0]!)

    expect(await screen.findByText('Could not save entry')).toBeInTheDocument()
  })

  it('requires an amount when saving an entry edit', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    await user.clear(screen.getByDisplayValue('5000'))
    await user.click(screen.getAllByRole('button', { name: 'Save income entry' })[0]!)

    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('deletes an income entry and reloads', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    vi.mocked(deleteIncomeEntry).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('Payslip')
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 14 Jan 2026' }).at(-1)!
    )

    await waitFor(() => expect(deleteIncomeEntry).toHaveBeenCalledWith(10))
    expect(listIncomeEntries).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when deleting an entry fails', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue(januaryYtd)
    vi.mocked(listIncomeEntries).mockResolvedValue([janEntry])
    vi.mocked(deleteIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not delete entry'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Jan 2026' }))
    await screen.findByText('Payslip')
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 14 Jan 2026' }).at(-1)!
    )

    expect(await screen.findByText('Could not delete entry')).toBeInTheDocument()
  })
})

describe('income page / non-PAYG income tax section', () => {
  const shareItem: IncomeEntry = {
    id: 20,
    incomeSourceId: null,
    userId: 1,
    year: 2026,
    month: 8,
    receivedOn: '2025-08-13T00:00:00.000+00:00',
    amount: 1000,
    note: 'Share sale',
    taxWithheld: false,
  }

  beforeEach(() => {
    vi.mocked(listUsers).mockReset()
    vi.mocked(listIncomeSources).mockReset()
    vi.mocked(getIncomeSourcesSummary).mockReset()
    vi.mocked(getIncomeYtd).mockReset()
    vi.mocked(listIncomeEntriesForFinancialYear).mockReset()
    vi.mocked(createIncomeEntry).mockReset()
    vi.mocked(updateIncomeEntry).mockReset()
    vi.mocked(deleteIncomeEntry).mockReset()
    vi.mocked(getIncomeTaxSetting).mockReset()
    vi.mocked(setIncomeTaxSetting).mockReset()
  })

  it('shows a hint when no marginal rate is set yet for the financial year', async () => {
    setDefaultMocks()
    render(IncomePage)

    expect(await screen.findByText('Non-PAYG Income Tax')).toBeInTheDocument()
    expect(await screen.findByText(/No rate set for/)).toBeInTheDocument()
  })

  it('saves a marginal tax rate', async () => {
    setDefaultMocks()
    vi.mocked(setIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Non-PAYG Income Tax')
    await user.type(screen.getByLabelText('Marginal tax rate (%)'), '37')
    await user.click(screen.getByRole('button', { name: 'Save rate' }))

    await waitFor(() =>
      expect(setIncomeTaxSetting).toHaveBeenCalledWith(1, currentFinancialYear(), 0.37)
    )
  })

  it('renders a non-PAYG item with computed tax and gain once a rate is set', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([shareItem])
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    render(IncomePage)

    expect(await screen.findByText('Share sale')).toBeInTheDocument()
    expect(screen.getAllByText('$370.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$630.00').length).toBeGreaterThan(0)
  })

  it('shows a dash for tax and gain on an item with tax withheld', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([
      { ...shareItem, note: 'Bonus', taxWithheld: true },
    ])
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    render(IncomePage)

    const row = (await screen.findByText('Bonus')).closest('tr')!
    expect(within(row).getAllByText('—')).toHaveLength(2)
  })

  it('edits a non-PAYG item inline and cancels without saving', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([shareItem])
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Cancel editing entry from 13 Aug 2025' })[0]!)

    expect(screen.queryByDisplayValue('1000')).toBeNull()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('saves an edited non-PAYG item and reloads', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([shareItem])
    vi.mocked(updateIncomeEntry).mockResolvedValue(shareItem)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    const amountInput = screen.getByDisplayValue('1000')
    await user.clear(amountInput)
    await user.type(amountInput, '1200')
    await user.click(screen.getAllByRole('button', { name: 'Save entry from 13 Aug 2025' })[0]!)

    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(20, {
        year: 2025,
        month: 8,
        amount: 1200,
        receivedOn: '2025-08-13',
        note: 'Share sale',
        taxWithheld: false,
      })
    )
    expect(listIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when saving a non-PAYG item edit fails', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([shareItem])
    vi.mocked(updateIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not save item'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    await user.click(screen.getAllByRole('button', { name: 'Save entry from 13 Aug 2025' })[0]!)

    expect(await screen.findByText('Could not save item')).toBeInTheDocument()
  })

  it('requires date, item and amount when saving a non-PAYG item edit', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([shareItem])
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    await user.clear(screen.getByDisplayValue('Share sale'))
    await user.click(screen.getAllByRole('button', { name: 'Save entry from 13 Aug 2025' })[0]!)

    expect(await screen.findByText('Date, item and amount are required')).toBeInTheDocument()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('requires date, item and amount to add a non-PAYG item', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Non-PAYG Income Tax')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Date, item and amount are required')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('shows an API error when adding a non-PAYG item fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not add item'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Non-PAYG Income Tax')
    await user.type(screen.getByLabelText('Item'), 'Share sale')
    await user.type(screen.getByLabelText('Sale amount'), '1000')
    await user.type(screen.getByLabelText('Date'), '2025-08-13')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Could not add item')).toBeInTheDocument()
  })

  it('shows an API error when saving a marginal rate fails', async () => {
    setDefaultMocks()
    vi.mocked(setIncomeTaxSetting).mockRejectedValue(new ApiError(500, 'Could not save rate'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Non-PAYG Income Tax')
    await user.type(screen.getByLabelText('Marginal tax rate (%)'), '37')
    await user.click(screen.getByRole('button', { name: 'Save rate' }))

    expect(await screen.findByText('Could not save rate')).toBeInTheDocument()
  })

  it('shows an API error when loading the non-PAYG section fails', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockRejectedValue(
      new ApiError(500, 'Could not load items')
    )
    render(IncomePage)

    expect(await screen.findByText('Could not load items')).toBeInTheDocument()
  })

  it('adds a non-PAYG item and reloads', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockResolvedValue(shareItem)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Non-PAYG Income Tax')
    await user.type(screen.getByLabelText('Item'), 'Share sale')
    await user.type(screen.getByLabelText('Sale amount'), '1000')
    await user.type(screen.getByLabelText('Date'), '2025-08-13')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        userId: 1,
        year: 2025,
        month: 8,
        amount: 1000,
        receivedOn: '2025-08-13',
        note: 'Share sale',
        taxWithheld: false,
      })
    )
    expect(listIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
  })

  it('deletes a non-PAYG item and reloads', async () => {
    setDefaultMocks()
    vi.mocked(listIncomeEntriesForFinancialYear).mockResolvedValue([shareItem])
    vi.mocked(deleteIncomeEntry).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 13 Aug 2025' }).at(-1)!
    )

    await waitFor(() => expect(deleteIncomeEntry).toHaveBeenCalledWith(20))
    expect(listIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
  })
})
