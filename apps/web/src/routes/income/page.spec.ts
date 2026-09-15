import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'svelte-sonner'
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
import {
  createIncomeSource,
  deleteIncomeSource,
  getIncomeSourcesSummary,
  listIncomeSources,
  updateIncomeSource,
  listAllIncomeEntriesForFinancialYear,
  listIncomeEntries,
  createIncomeEntry,
  updateIncomeEntry,
  deleteIncomeEntry,
  getIncomeYtd,
  type IncomeSource,
  type IncomeSourceSummary,
  type IncomeEntry,
} from '$lib/api/income'
import { getIncomeTaxSetting, setIncomeTaxSetting } from '$lib/api/income_tax_settings'
import { listUsers, type UserSummary } from '$lib/api/users'
import { ApiError } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import { currentFinancialYear, financialYearLabel, todayISO } from '$lib/format'
import IncomePage from './+page.svelte'

vi.mock('$lib/api/income', () => ({
  listIncomeSources: vi.fn(),
  createIncomeSource: vi.fn(),
  updateIncomeSource: vi.fn(),
  deleteIncomeSource: vi.fn(),
  getIncomeSourcesSummary: vi.fn(),
  listAllIncomeEntriesForFinancialYear: vi.fn(),
  listIncomeEntries: vi.fn(),
  createIncomeEntry: vi.fn(),
  updateIncomeEntry: vi.fn(),
  deleteIncomeEntry: vi.fn(),
  getIncomeYtd: vi.fn(),
}))
vi.mock('$lib/api/income_tax_settings', () => ({
  getIncomeTaxSetting: vi.fn(),
  setIncomeTaxSetting: vi.fn(),
}))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn() }))
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
}))

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

const noTaxSetting = { userId: 1, financialYear: 2026, marginalRate: null }

const salaryEntry: IncomeEntry = {
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

const otherEntry: IncomeEntry = {
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

function setDefaultMocks() {
  vi.mocked(listUsers).mockResolvedValue([brian, ariel])
  vi.mocked(listIncomeSources).mockResolvedValue([brianSalary, arielWages])
  vi.mocked(getIncomeSourcesSummary).mockResolvedValue(summaries)
  vi.mocked(listAllIncomeEntriesForFinancialYear).mockResolvedValue([])
  vi.mocked(listIncomeEntries).mockResolvedValue([])
  vi.mocked(getIncomeYtd).mockResolvedValue({
    financialYear: currentFinancialYear(),
    sources: [],
    months: [],
    ytdTotal: 0,
  })
  vi.mocked(getIncomeTaxSetting).mockResolvedValue(noTaxSetting)
}

function setEntries(...entries: IncomeEntry[]) {
  vi.mocked(listAllIncomeEntriesForFinancialYear).mockResolvedValue(entries)
}

// Opens the "Add" menu and picks one of its options (Salary / Other income).
// Not getByRole('menuitem', { name }) - see ActionMenu.spec.ts's
// top-of-file comment: bits-ui's floating menu content never resolves out
// of `visibility: hidden` under jsdom (no real layout), and that's
// inherited by descendants, which empties out the accessible-name
// computation `getByRole(..., { name })` relies on. `getByText` matches raw
// text content instead, unaffected by that.
async function chooseAddOption(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(await screen.findByRole('button', { name: 'Add income' }))
  // Scoped to the open menu, not a page-wide findByText - Income's own
  // All/Salary/Other filter tabs already put a "Salary" text node on the
  // page, so an unscoped query matches both.
  const menu = await screen.findByRole('menu', { hidden: true })
  await user.click(within(menu).getByText(option))
}

// bits-ui's body-scroll-lock leaves `<body>`'s `pointer-events: none` in
// place (resetting it only after a debounced timer, see src/tests/setup.ts)
// while any menu/sheet is open. Call this after closing one, before
// interacting with the page again with userEvent, or its clicks refuse to
// fire through the inherited pointer-events:none. Interactions *inside* an
// open sheet use `fireEvent` instead, which ignores it.
function waitForBodyInteractive() {
  return waitFor(() => expect(getComputedStyle(document.body).pointerEvents).not.toBe('none'))
}

// The Sheet/Drawer a form opens into is portalled onto `document.body`.
function openSheet() {
  return screen.getByRole('dialog', { hidden: true })
}

describe('income page', () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockReset()
    vi.mocked(listIncomeSources).mockReset()
    vi.mocked(getIncomeSourcesSummary).mockReset()
    vi.mocked(createIncomeSource).mockReset()
    vi.mocked(updateIncomeSource).mockReset()
    vi.mocked(deleteIncomeSource).mockReset()
    vi.mocked(listAllIncomeEntriesForFinancialYear).mockReset()
    vi.mocked(listIncomeEntries).mockReset()
    vi.mocked(createIncomeEntry).mockReset()
    vi.mocked(updateIncomeEntry).mockReset()
    vi.mocked(deleteIncomeEntry).mockReset()
    vi.mocked(getIncomeYtd).mockReset()
    vi.mocked(getIncomeTaxSetting).mockReset()
    vi.mocked(setIncomeTaxSetting).mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(confirmDestructive).mockReset()
    vi.mocked(confirmDestructive).mockResolvedValue(true)
  })

  afterEach(() => {
    authState.user = null
  })

  it('shows a loading state, then an API error on failure', async () => {
    vi.mocked(listUsers).mockRejectedValue(new ApiError(500, 'Could not load users'))
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(getIncomeSourcesSummary).mockResolvedValue([])
    render(IncomePage)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
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

    expect(await screen.findByText('$5,000.00/mo')).toBeInTheDocument()
    expect(screen.getByText('$5,650.60/mo')).toBeInTheDocument()
    expect(screen.getByText('Brian Income')).toBeInTheDocument()
    expect(screen.queryByText('Ariel Income')).toBeNull()
  })

  it('defaults to the logged-in user’s tab instead of the first user listed', async () => {
    setDefaultMocks()
    authState.user = {
      id: 2,
      fullName: 'Ariel',
      email: 'ariel@example.com',
      displayColor: null,
      initials: 'A',
    }
    render(IncomePage)

    expect(await screen.findByText('Ariel Income')).toBeInTheDocument()
    expect(screen.queryByText('Brian Income')).toBeNull()
  })

  it('falls back to the first user when the logged-in user has no income tab', async () => {
    setDefaultMocks()
    authState.user = {
      id: 99,
      fullName: 'Someone Else',
      email: 'someone@example.com',
      displayColor: null,
      initials: 'S',
    }
    render(IncomePage)

    expect(await screen.findByText('Brian Income')).toBeInTheDocument()
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
    vi.mocked(listAllIncomeEntriesForFinancialYear).mockResolvedValue([])
    vi.mocked(getIncomeTaxSetting).mockResolvedValue(noTaxSetting)
    render(IncomePage)

    expect(await screen.findByText('No income sources yet.')).toBeInTheDocument()
  })

  it('keeps the add-source form hidden until "Add source" is clicked', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)
    await screen.findByText('Brian Income')

    expect(screen.queryByRole('button', { name: 'Add income source' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Add source' }))
    expect(screen.getByRole('button', { name: 'Add income source' })).toBeInTheDocument()
  })

  it('requires a name and expected amount to add a source', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Add source' }))
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add income source' }))

    expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    expect(createIncomeSource).not.toHaveBeenCalled()
  })

  it('requires a pay day for a monthly source', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Add source' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Bonus' } })
    await fireEvent.input(within(sheet).getByLabelText('Expected per pay'), {
      target: { value: '100' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add income source' }))

    expect(await screen.findByText('Enter a pay day of the month')).toBeInTheDocument()
    expect(createIncomeSource).not.toHaveBeenCalled()
  })

  it('requires an anchor date for a fortnightly source', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Add source' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Side gig' } })
    await fireEvent.input(within(sheet).getByLabelText('Expected per pay'), {
      target: { value: '100' },
    })
    await fireEvent.change(within(sheet).getByLabelText('Frequency'), {
      target: { value: 'fortnightly' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add income source' }))

    expect(await screen.findByText('Pick an anchor pay date')).toBeInTheDocument()
    expect(createIncomeSource).not.toHaveBeenCalled()
  })

  it('adds a monthly income source, closes the form, and reloads the list', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeSource).mockResolvedValue(brianSalary)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Add source' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Bonus' } })
    await fireEvent.input(within(sheet).getByLabelText('Expected per pay'), {
      target: { value: '250' },
    })
    await fireEvent.input(within(sheet).getByLabelText('Pay day of month'), {
      target: { value: '1' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add income source' }))

    await waitFor(() =>
      expect(createIncomeSource).toHaveBeenCalledWith({
        userId: 1,
        name: 'Bonus',
        expectedAmount: 250,
        frequency: 'monthly',
        payDayOfMonth: 1,
        weekendRollback: false,
        taxWithheld: true,
      })
    )
    // The inactive cadence field must be `undefined`, not `null`: the create
    // validator is `.optional()` but not `.nullable()` (unlike update), and
    // JSON.stringify drops an `undefined` key entirely.
    expect(vi.mocked(createIncomeSource).mock.calls[0]![0].anchorDate).toBeUndefined()
    expect(listIncomeSources).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Income source added')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Add income source' })).toBeNull()
    )
  })

  it('shows an API error when adding a source fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeSource).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click(await screen.findByRole('button', { name: 'Add source' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Bonus' } })
    await fireEvent.input(within(sheet).getByLabelText('Expected per pay'), {
      target: { value: '250' },
    })
    await fireEvent.input(within(sheet).getByLabelText('Pay day of month'), {
      target: { value: '1' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add income source' }))

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

    await waitFor(() => expect(deleteIncomeSource).toHaveBeenCalledWith(1))
    expect(confirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete Brian Income?' })
    )
    expect(toast.success).toHaveBeenCalledWith('Income source deleted')
    expect(await screen.findByText('$0.00/mo')).toBeInTheDocument()
  })

  it('does not delete a source when the confirmation is declined', async () => {
    setDefaultMocks()
    vi.mocked(confirmDestructive).mockResolvedValue(false)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Delete Brian Income' }))[0]!)
    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled())

    expect(deleteIncomeSource).not.toHaveBeenCalled()
  })

  it('edits a source: switching cadence, saving, and reloading', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeSource).mockResolvedValue(brianSalary)
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), {
      target: { value: 'Brian Salary' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

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
    expect(toast.success).toHaveBeenCalledWith('Income source saved')
  })

  it('cancels an edit without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    const sheet = openSheet()
    expect(within(sheet).getByLabelText('Name')).toHaveValue('Brian Income')
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByDisplayValue('Brian Income')).toBeNull()
    expect(updateIncomeSource).not.toHaveBeenCalled()
  })

  it('shows a validation error when editing to a blank name', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: '' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Enter a name')).toBeInTheDocument()
    expect(updateIncomeSource).not.toHaveBeenCalled()
  })

  it('shows an API error when saving an edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeSource).mockRejectedValue(new ApiError(500, 'Could not save'))
    const user = userEvent.setup()
    render(IncomePage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Brian Income' }))[0]!)
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
  })

  it('shows a "no income logged" message when the entries table is empty', async () => {
    setDefaultMocks()
    render(IncomePage)
    expect(
      await screen.findByText(`No income logged for ${financialYearLabel(currentFinancialYear())}.`)
    ).toBeInTheDocument()
  })

  it('shows the YTD summary line and per-type totals', async () => {
    setDefaultMocks()
    setEntries(salaryEntry, otherEntry)
    render(IncomePage)

    expect(await screen.findByText('Share sale')).toBeInTheDocument()
    expect(screen.getByText('To date')).toBeInTheDocument()
    expect(screen.getAllByText('$6,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThan(0)
  })

  it('nets other income through the marginal rate in the YTD summary', async () => {
    setDefaultMocks()
    setEntries(salaryEntry, otherEntry)
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    render(IncomePage)

    await screen.findByText('Share sale')
    // Salary $5,000.00 (net) + Other gain $630.00 (1000 - 370) = $5,630.00.
    expect(screen.getAllByText('$5,630.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$630.00').length).toBeGreaterThan(0)
    // The gross sale total still appears in the table, not the summary.
    expect(screen.getAllByText('$6,000.00').length).toBeGreaterThan(0)
  })

  it('counts a withheld other-income item at its full amount in the summary', async () => {
    setDefaultMocks()
    setEntries(salaryEntry, { ...otherEntry, taxWithheld: true })
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    render(IncomePage)

    await screen.findByText('Share sale')
    expect(screen.getAllByText('$6,000.00').length).toBeGreaterThan(0)
  })

  it('shows only the selected user’s entries', async () => {
    setDefaultMocks()
    setEntries(
      salaryEntry,
      otherEntry,
      { ...salaryEntry, id: 11, incomeSourceId: 2, note: 'Ariel entry' },
      { ...otherEntry, id: 12, userId: 2, note: 'Ariel freelance' }
    )
    render(IncomePage)

    await screen.findByText('Payslip')
    expect(screen.getByText('Share sale')).toBeInTheDocument()
    expect(screen.queryByText('Ariel entry')).toBeNull()
    expect(screen.queryByText('Ariel freelance')).toBeNull()
  })

  it('filters the entries table by All / Salary / Other', async () => {
    setDefaultMocks()
    setEntries(salaryEntry, otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    expect(screen.getByText('Payslip')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Salary/ }))
    expect(screen.getByText('Payslip')).toBeInTheDocument()
    expect(screen.queryByText('Share sale')).toBeNull()

    await user.click(screen.getByRole('radio', { name: /Other/ }))
    expect(screen.queryByText('Payslip')).toBeNull()
    expect(screen.getByText('Share sale')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^All/ }))
    expect(screen.getByText('Payslip')).toBeInTheDocument()
    expect(screen.getByText('Share sale')).toBeInTheDocument()
  })

  it('shows filter-specific empty messages', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getByRole('radio', { name: /Salary/ }))
    expect(
      await screen.findByText(
        `No salary income logged for ${financialYearLabel(currentFinancialYear())}.`
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^All/ }))
    await user.click(screen.getByRole('radio', { name: /Other/ }))
    expect(screen.queryByText('No other income logged')).toBeNull()
  })

  it('navigates to the previous year and reloads entries, disabling Next at the current financial year', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)
    await screen.findByText('Brian Income')

    const thisFinancialYear = currentFinancialYear()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '← Prev' }))

    expect(screen.getAllByText(financialYearLabel(thisFinancialYear - 1)).length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(listAllIncomeEntriesForFinancialYear).toHaveBeenLastCalledWith(thisFinancialYear - 1)
    )
    expect(screen.getByRole('button', { name: 'Next →' })).not.toBeDisabled()
  })

  it('shows an API error when loading entries fails', async () => {
    setDefaultMocks()
    vi.mocked(listAllIncomeEntriesForFinancialYear).mockRejectedValue(
      new ApiError(500, 'Could not load income')
    )
    render(IncomePage)
    expect(await screen.findByText('Could not load income')).toBeInTheDocument()
  })

  it('shows a hint when no marginal rate is set yet for the financial year', async () => {
    setDefaultMocks()
    render(IncomePage)

    expect(await screen.findByText(/No marginal rate set for/)).toBeInTheDocument()
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

    await screen.findByText('Income entries')
    await user.type(screen.getByLabelText('Marginal rate'), '37')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(setIncomeTaxSetting).toHaveBeenCalledWith(1, currentFinancialYear(), 0.37)
    )
  })

  it('shows an API error when saving a marginal rate fails', async () => {
    setDefaultMocks()
    vi.mocked(setIncomeTaxSetting).mockRejectedValue(new ApiError(500, 'Could not save rate'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Income entries')
    await user.type(screen.getByLabelText('Marginal rate'), '37')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save rate')).toBeInTheDocument()
  })

  it('renders an other-income row with computed tax and gain once a rate is set', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
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

  it('shows a dash for tax and gain on a salary row', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    render(IncomePage)

    await screen.findByText('Payslip')
    const row = screen.getByText('Payslip').closest('tr')!
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the add-salary sheet closed until it is chosen from the Add menu', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Brian Income')
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()

    await chooseAddOption(user, 'Salary')
    const sheet = openSheet()
    expect(
      within(sheet).getByRole('heading', { name: 'Log salary', hidden: true })
    ).toBeInTheDocument()
  })

  it('only opens one sheet at a time', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)
    await screen.findByText('Brian Income')

    await chooseAddOption(user, 'Salary')
    let sheet = openSheet()
    expect(
      within(sheet).getByRole('heading', { name: 'Log salary', hidden: true })
    ).toBeInTheDocument()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    await waitForBodyInteractive()

    await chooseAddOption(user, 'Other income')
    sheet = openSheet()
    expect(
      within(sheet).getByRole('heading', { name: 'Add other income', hidden: true })
    ).toBeInTheDocument()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    await waitForBodyInteractive()

    // Opening the source sheet replaces the entry sheet.
    await user.click(screen.getByRole('button', { name: 'Add source' }))
    const sourceSheet = openSheet()
    expect(
      within(sourceSheet).getByRole('button', { name: 'Add income source' })
    ).toBeInTheDocument()
  })

  it('requires an amount to log a salary entry', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Salary')
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log entry' }))

    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('requires a received-on date to log a salary entry', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Salary')
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '5000' } })
    await fireEvent.input(within(sheet).getByLabelText('Received on'), { target: { value: '' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log entry' }))

    expect(await screen.findByText('Pick a date')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('pre-fills the salary sheet’s received-on date with today', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Salary')
    expect(within(openSheet()).getByLabelText('Received on')).toHaveValue(todayISO())
  })

  it('logs a new salary entry, closes the sheet, and reloads', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Salary')
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '5000' } })
    await fireEvent.input(within(sheet).getByLabelText('Received on'), {
      target: { value: '2026-01-14' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log entry' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: 1,
        year: 2026,
        month: 1,
        amount: 5000,
        receivedOn: '2026-01-14',
        note: null,
      })
    )
    expect(listAllIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Income entry added')
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull())
  })

  it('shows an API error when logging a salary entry fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not log income'))
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Salary')
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '5000' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log entry' }))

    expect(await screen.findByText('Could not log income')).toBeInTheDocument()
  })

  it('edits a salary entry in a sheet and cancels without saving', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    const sheet = openSheet()
    expect(within(sheet).getByLabelText('Amount')).toHaveValue(5000)
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByDisplayValue('5000')).toBeNull()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('saves an edited salary entry and reloads', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    vi.mocked(updateIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '5200' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(10, {
        year: 2026,
        month: 1,
        amount: 5200,
        receivedOn: '2026-01-14',
        note: 'Payslip',
      })
    )
    expect(listAllIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Income entry saved')
  })

  it('shows an API error when saving a salary entry edit fails', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    vi.mocked(updateIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not save entry'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Could not save entry')).toBeInTheDocument()
  })

  it('requires an amount when saving a salary entry edit', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Payslip')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 14 Jan 2026' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('deletes a salary entry and reloads', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    vi.mocked(deleteIncomeEntry).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Payslip')
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 14 Jan 2026' }).at(-1)!
    )

    await waitFor(() => expect(deleteIncomeEntry).toHaveBeenCalledWith(10))
    expect(listAllIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when deleting an entry fails', async () => {
    setDefaultMocks()
    setEntries(salaryEntry)
    vi.mocked(deleteIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not delete entry'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Payslip')
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 14 Jan 2026' }).at(-1)!
    )

    expect(await screen.findByText('Could not delete entry')).toBeInTheDocument()
  })

  it('keeps the add-other-income sheet closed until it is chosen from the Add menu', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Brian Income')
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()

    await chooseAddOption(user, 'Other income')
    const sheet = openSheet()
    expect(
      within(sheet).getByRole('heading', { name: 'Add other income', hidden: true })
    ).toBeInTheDocument()
  })

  it('requires a date and item to add an other-income entry', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Other income')
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Received on'), { target: { value: '' } })
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '1000' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText('Pick a date')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('adds an other-income entry, closes the sheet, and reloads', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockResolvedValue(otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Other income')
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Item'), { target: { value: 'Share sale' } })
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '1000' } })
    await fireEvent.input(within(sheet).getByLabelText('Received on'), {
      target: { value: '2025-08-13' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add entry' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: null,
        userId: 1,
        year: 2025,
        month: 8,
        amount: 1000,
        receivedOn: '2025-08-13',
        note: 'Share sale',
        taxWithheld: false,
      })
    )
    expect(listAllIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Income entry added')
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).toBeNull())
  })

  it('shows an API error when adding an other-income entry fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not add item'))
    const user = userEvent.setup()
    render(IncomePage)

    await chooseAddOption(user, 'Other income')
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Item'), { target: { value: 'Share sale' } })
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '1000' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText('Could not add item')).toBeInTheDocument()
  })

  it('edits an other-income entry in a sheet and cancels without saving', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    const sheet = openSheet()
    expect(within(sheet).getByLabelText('Amount')).toHaveValue(1000)
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByDisplayValue('1000')).toBeNull()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('saves an edited other-income entry and reloads', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    vi.mocked(updateIncomeEntry).mockResolvedValue(otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '1200' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(20, {
        year: 2025,
        month: 8,
        amount: 1200,
        receivedOn: '2025-08-13',
        note: 'Share sale',
        taxWithheld: false,
        userId: 1,
      })
    )
    expect(listAllIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when saving an other-income edit fails', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    vi.mocked(updateIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not save item'))
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Could not save item')).toBeInTheDocument()
  })

  it('requires an item when saving an other-income edit', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Item'), { target: { value: '' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Enter an item')).toBeInTheDocument()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('requires a person when saving an other-income edit with no owner', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    const sheet = openSheet()
    await fireEvent.change(within(sheet).getByLabelText('Owner'), { target: { value: '' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('A person is required for other income')).toBeInTheDocument()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('deletes an other-income entry and reloads', async () => {
    setDefaultMocks()
    setEntries(otherEntry)
    vi.mocked(deleteIncomeEntry).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(IncomePage)

    await screen.findByText('Share sale')
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 13 Aug 2025' }).at(-1)!
    )

    await waitFor(() => expect(deleteIncomeEntry).toHaveBeenCalledWith(20))
    expect(listAllIncomeEntriesForFinancialYear).toHaveBeenCalledTimes(2)
  })

  it('shows combined totals in the footer for the active filter', async () => {
    setDefaultMocks()
    setEntries(salaryEntry, otherEntry)
    vi.mocked(getIncomeTaxSetting).mockResolvedValue({
      userId: 1,
      financialYear: currentFinancialYear(),
      marginalRate: 0.37,
    })
    render(IncomePage)

    await screen.findByText('Share sale')
    const entriesTable = screen.getAllByRole('table')[0]!
    expect(within(entriesTable).getAllByText('$6,000.00').length).toBeGreaterThan(0)
    expect(within(entriesTable).getAllByText('$370.00').length).toBeGreaterThan(0)
    expect(within(entriesTable).getAllByText('$630.00').length).toBeGreaterThan(0)
  })

  describe('charts section', () => {
    // Entries that fall inside the current financial year so they count for
    // the selected-year pies (Jul 2026 - Jun 2027 with today in Aug 2026).
    const brianSalaryChart = { ...salaryEntry, id: 30, year: 2026, month: 8, amount: 5000 }
    const brianFreelanceChart = {
      ...otherEntry,
      id: 31,
      year: 2026,
      month: 8,
      amount: 1000,
      note: 'Brian freelance',
    }
    const arielSalaryChart = {
      ...salaryEntry,
      id: 32,
      incomeSourceId: 2,
      year: 2026,
      month: 8,
      amount: 5000,
    }
    const arielFreelanceChart = {
      ...otherEntry,
      id: 33,
      userId: 2,
      year: 2026,
      month: 8,
      amount: 1000,
      note: 'Ariel freelance',
    }

    async function openCharts(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /Charts/ }))
    }

    it('stays collapsed and defers loading until opened', async () => {
      setDefaultMocks()
      render(IncomePage)

      await screen.findByText('Brian Income')
      expect(screen.queryByText('Estimated vs actual income')).not.toBeInTheDocument()
      expect(listIncomeEntries).not.toHaveBeenCalled()

      const user = userEvent.setup()
      await openCharts(user)
      expect(await screen.findByText('Estimated vs actual income')).toBeInTheDocument()
      expect(screen.getByText('Year by year')).toBeInTheDocument()
      expect(screen.getByText('Income by person')).toBeInTheDocument()
      expect(screen.getByText('Salary vs other income')).toBeInTheDocument()
      expect(listIncomeEntries).toHaveBeenCalledTimes(1)
    })

    it('nets income through each person’s marginal rate in the pies', async () => {
      setDefaultMocks()
      vi.mocked(listIncomeEntries).mockResolvedValue([
        brianSalaryChart,
        brianFreelanceChart,
        arielSalaryChart,
        arielFreelanceChart,
      ])
      vi.mocked(getIncomeTaxSetting).mockImplementation(async (userId: number) =>
        userId === 1
          ? { userId: 1, financialYear: currentFinancialYear(), marginalRate: 0.37 }
          : { userId: 2, financialYear: currentFinancialYear(), marginalRate: 0.3 }
      )
      render(IncomePage)

      await screen.findByText('Brian Income')
      const user = userEvent.setup()
      await openCharts(user)

      // Brian: 5000 salary + 1000 freelance - 370 = 5630. Ariel: 5000 + 700 = 5700.
      expect(await screen.findByText('$5,630.00')).toBeInTheDocument()
      expect(screen.getByText('$5,700.00')).toBeInTheDocument()
      // Salary 5000 + 5000 = 10000; other 630 + 700 = 1330.
      expect(screen.getByText('$10,000.00')).toBeInTheDocument()
      expect(screen.getByText('$1,330.00')).toBeInTheDocument()
    })

    it('renders the estimated vs actual months from the ytd endpoint', async () => {
      setDefaultMocks()
      vi.mocked(listIncomeEntries).mockResolvedValue([brianSalaryChart])
      vi.mocked(getIncomeYtd).mockResolvedValue({
        financialYear: currentFinancialYear(),
        sources: [{ id: 1, name: 'Brian Income' }],
        months: [
          {
            year: 2026,
            month: 7,
            bySource: { 1: 0 },
            total: 5000,
            actual: 0,
            projected: 5000,
            estimated: true,
          },
          {
            year: 2026,
            month: 8,
            bySource: { 1: 5000 },
            total: 5000,
            actual: 5000,
            projected: 5000,
            estimated: false,
          },
        ],
        ytdTotal: 10000,
      })
      render(IncomePage)

      await screen.findByText('Brian Income')
      const user = userEvent.setup()
      await openCharts(user)

      expect(await screen.findByText('Estimated vs actual income')).toBeInTheDocument()
      expect(screen.getByText('Actual')).toBeInTheDocument()
      expect(screen.getByText('Estimated')).toBeInTheDocument()
    })

    it('shows empty states when there is no income', async () => {
      setDefaultMocks()
      render(IncomePage)

      await screen.findByText('Brian Income')
      const user = userEvent.setup()
      await openCharts(user)

      expect(await screen.findAllByText('Not enough data yet')).toHaveLength(2)
      expect(screen.getAllByText('No income logged this year')).toHaveLength(2)
    })

    it('shows an error when chart data fails to load', async () => {
      setDefaultMocks()
      vi.mocked(listIncomeEntries).mockRejectedValue(new ApiError(500, 'Could not load charts'))
      render(IncomePage)

      await screen.findByText('Brian Income')
      const user = userEvent.setup()
      await openCharts(user)

      expect(await screen.findByText('Could not load charts')).toBeInTheDocument()
    })
  })
})
