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
  type IncomeSource,
  type IncomeSourceSummary,
  type IncomeYtd,
} from '$lib/api/income'
import { listUsers, type UserSummary } from '$lib/api/users'
import { ApiError } from '$lib/api'
import IncomePage from './+page.svelte'

vi.mock('$lib/api/income', () => ({
  listIncomeSources: vi.fn(),
  createIncomeSource: vi.fn(),
  updateIncomeSource: vi.fn(),
  deleteIncomeSource: vi.fn(),
  getIncomeSourcesSummary: vi.fn(),
  getIncomeYtd: vi.fn(),
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

const emptyYtd: IncomeYtd = { year: 2026, sources: [], months: [], ytdTotal: 0 }

function setDefaultMocks() {
  vi.mocked(listUsers).mockResolvedValue([brian, ariel])
  vi.mocked(listIncomeSources).mockResolvedValue([brianSalary, arielWages])
  vi.mocked(getIncomeSourcesSummary).mockResolvedValue(summaries)
  vi.mocked(getIncomeYtd).mockResolvedValue(emptyYtd)
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

    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    expect(deleteIncomeSource).toHaveBeenCalledWith(1)
    expect(await screen.findByText('$0.00/mo · 0 sources')).toBeInTheDocument()
  })

  it('edits a source: switching cadence, saving, and reloading', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeSource).mockResolvedValue(brianSalary)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('Brian Income')
    await user.clear(nameInput)
    await user.type(nameInput, 'Brian Salary')
    await user.click(screen.getByRole('button', { name: 'Save' }))

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

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByDisplayValue('Brian Income')).toBeNull()
    expect(updateIncomeSource).not.toHaveBeenCalled()
  })

  it('shows a validation error when editing to a blank name', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByDisplayValue('Brian Income'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Name and expected amount are required')).toBeInTheDocument()
    expect(updateIncomeSource).not.toHaveBeenCalled()
  })

  it('shows an API error when saving an edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeSource).mockRejectedValue(new ApiError(500, 'Could not save'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
  })

  it('shows the year-to-date table with source columns, an estimated tag, and a running total', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockResolvedValue({
      year: 2026,
      sources: [{ id: 1, name: 'Brian Income' }],
      months: [
        { month: 1, bySource: { 1: 5000 }, total: 5000, estimated: false },
        { month: 2, bySource: { 1: 5000 }, total: 5000, estimated: true },
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
      await screen.findByText(`No data yet for ${new Date().getFullYear()}.`)
    ).toBeInTheDocument()
  })

  it('navigates to the previous year and reloads YTD, disabling Next at the current year', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)
    await screen.findByText('Brian Income')

    const currentYear = new Date().getFullYear()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '← Prev' }))

    expect(screen.getByText(String(currentYear - 1))).toBeInTheDocument()
    await waitFor(() => expect(getIncomeYtd).toHaveBeenLastCalledWith(1, currentYear - 1))
    expect(screen.getByRole('button', { name: 'Next →' })).not.toBeDisabled()
  })

  it('shows an API error when loading YTD fails', async () => {
    setDefaultMocks()
    vi.mocked(getIncomeYtd).mockRejectedValue(new ApiError(500, 'Could not load YTD'))
    render(IncomePage)
    expect(await screen.findByText('Could not load YTD')).toBeInTheDocument()
  })
})
