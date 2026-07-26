import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRecurringBill,
  deleteRecurringBill,
  listUpcomingRecurringBills,
  updateRecurringBill,
  type UpcomingRecurringBill,
} from '$lib/api/recurring-bills'
import { listCategories, type Category } from '$lib/api/categories'
import { formatDate, formatDaysUntilDue } from '$lib/format'
import { ApiError } from '$lib/api'
import RecurringBillsPage from './+page.svelte'

vi.mock('$lib/api/recurring-bills', () => ({
  listUpcomingRecurringBills: vi.fn(),
  createRecurringBill: vi.fn(),
  updateRecurringBill: vi.fn(),
  deleteRecurringBill: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn() }))

const insurance: Category = {
  id: 1,
  name: 'Insurance',
  color: null,
  sortOrder: 0,
  budgetAmount: null,
  budgetItemCount: 0,
  includeInStandardMonth: true,
  isActive: true,
}

const carInsurance: UpcomingRecurringBill = {
  id: 1,
  name: 'Car Insurance',
  categoryId: 1,
  amount: 600,
  frequency: 'annual',
  customIntervalValue: null,
  customIntervalUnit: null,
  dueDay: null,
  dueMonth: null,
  dueYear: null,
  nextDueOn: '2026-08-01T00:00:00.000+00:00',
  isActive: true,
  notes: null,
  createdAt: '',
  updatedAt: '',
  daysUntilDue: 5,
  dueSoon: true,
}
const pestControl: UpcomingRecurringBill = {
  id: 2,
  name: 'Pest Control',
  categoryId: null,
  amount: 120,
  frequency: 'custom',
  customIntervalValue: 3,
  customIntervalUnit: 'months',
  dueDay: null,
  dueMonth: null,
  dueYear: null,
  nextDueOn: '2026-07-20T00:00:00.000+00:00',
  isActive: true,
  notes: null,
  createdAt: '',
  updatedAt: '',
  daysUntilDue: -3,
  dueSoon: true,
}
const gym: UpcomingRecurringBill = {
  id: 3,
  name: 'Gym Membership',
  categoryId: null,
  amount: 50,
  frequency: 'monthly',
  customIntervalValue: null,
  customIntervalUnit: null,
  dueDay: null,
  dueMonth: null,
  dueYear: null,
  nextDueOn: '2026-09-01T00:00:00.000+00:00',
  isActive: true,
  notes: null,
  createdAt: '',
  updatedAt: '',
  daysUntilDue: 37,
  dueSoon: false,
}

function setDefaultMocks() {
  vi.mocked(listUpcomingRecurringBills).mockResolvedValue([carInsurance, pestControl, gym])
  vi.mocked(listCategories).mockResolvedValue([insurance])
}

describe('recurring bills page', () => {
  beforeEach(() => {
    vi.mocked(listUpcomingRecurringBills).mockReset()
    vi.mocked(listCategories).mockReset()
    vi.mocked(createRecurringBill).mockReset()
    vi.mocked(updateRecurringBill).mockReset()
    vi.mocked(deleteRecurringBill).mockReset()
  })

  it('shows a loading state, then an API error on failure', async () => {
    vi.mocked(listUpcomingRecurringBills).mockRejectedValue(
      new ApiError(500, 'Could not load bills')
    )
    vi.mocked(listCategories).mockResolvedValue([])
    render(RecurringBillsPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Could not load bills')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(listUpcomingRecurringBills).mockRejectedValue(new Error('boom'))
    vi.mocked(listCategories).mockResolvedValue([])
    render(RecurringBillsPage)
    expect(await screen.findByText('Failed to load recurring bills')).toBeInTheDocument()
  })

  it('renders only the header row when there are no bills', async () => {
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([])
    vi.mocked(listCategories).mockResolvedValue([])
    render(RecurringBillsPage)

    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })

  it('shows frequency labels, formatted dates, and due-soon badges', async () => {
    setDefaultMocks()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    const carRow = screen.getByText('Car Insurance').closest('tr')!
    const pestRow = screen.getByText('Pest Control').closest('tr')!
    const gymRow = screen.getByText('Gym Membership').closest('tr')!
    expect(within(carRow).getByText('Annual')).toBeInTheDocument()
    expect(within(pestRow).getByText('Every 3 months')).toBeInTheDocument()
    expect(within(gymRow).getByText('Monthly')).toBeInTheDocument()

    expect(within(carRow).getByText(formatDate(carInsurance.nextDueOn))).toBeInTheDocument()
    expect(within(pestRow).getByText(formatDate(pestControl.nextDueOn))).toBeInTheDocument()

    const dueSoonBadge = screen.getByText(formatDaysUntilDue(5))
    expect(dueSoonBadge.className).toContain('bg-amber-100')
    const overdueBadge = screen.getByText(formatDaysUntilDue(-3))
    expect(overdueBadge.className).toContain('bg-red-100')

    expect(within(gymRow).queryByText(/Due/)).toBeNull()
  })

  it('changes a bill category and reloads', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockResolvedValue({ ...carInsurance, categoryId: null })
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const row = (await screen.findByText('Car Insurance')).closest('tr')!
    const select = within(row).getByRole('combobox')
    await user.selectOptions(select, 'Uncategorized')

    expect(updateRecurringBill).toHaveBeenCalledWith(1, { categoryId: null })
    await waitFor(() => expect(listUpcomingRecurringBills).toHaveBeenCalledTimes(2))
  })

  it('shows an error when changing category fails', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockRejectedValue(new ApiError(500, 'Could not update category'))
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const row = (await screen.findByText('Car Insurance')).closest('tr')!
    const select = within(row).getByRole('combobox')
    await user.selectOptions(select, 'Insurance')

    expect(await screen.findByText('Could not update category')).toBeInTheDocument()
  })

  it('deletes a bill without refetching', async () => {
    setDefaultMocks()
    vi.mocked(deleteRecurringBill).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!)

    expect(deleteRecurringBill).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Car Insurance')).toBeNull())
    expect(listUpcomingRecurringBills).toHaveBeenCalledTimes(1)
  })

  it('shows an error when deleting fails', async () => {
    setDefaultMocks()
    vi.mocked(deleteRecurringBill).mockRejectedValue(new ApiError(500, 'Could not delete'))
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!)

    expect(await screen.findByText('Could not delete')).toBeInTheDocument()
  })

  it('requires a name, amount, and next due date to add a bill', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.click(await screen.findByRole('button', { name: 'Add bill' }))

    expect(
      await screen.findByText('Name, amount, and next due date are required')
    ).toBeInTheDocument()
    expect(createRecurringBill).not.toHaveBeenCalled()
  })

  it('adds a monthly bill and reloads the list', async () => {
    setDefaultMocks()
    vi.mocked(createRecurringBill).mockResolvedValue(gym)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.type(await screen.findByPlaceholderText('e.g. Netflix'), 'Water')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '80')
    await user.selectOptions(screen.getByLabelText('Frequency'), 'monthly')
    await fireEvent.input(screen.getByLabelText('Next due'), { target: { value: '2026-09-15' } })
    await user.click(screen.getByRole('button', { name: 'Add bill' }))

    await waitFor(() =>
      expect(createRecurringBill).toHaveBeenCalledWith({
        name: 'Water',
        amount: 80,
        frequency: 'monthly',
        customIntervalValue: undefined,
        customIntervalUnit: undefined,
        nextDueOn: '2026-09-15',
        categoryId: undefined,
      })
    )
    expect(listUpcomingRecurringBills).toHaveBeenCalledTimes(2)
  })

  it('adds a custom-frequency bill with an interval value and unit', async () => {
    setDefaultMocks()
    vi.mocked(createRecurringBill).mockResolvedValue(pestControl)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.type(await screen.findByPlaceholderText('e.g. Netflix'), 'Termite Check')
    await user.selectOptions(screen.getByLabelText('Frequency'), 'custom')
    const spinbuttons = screen.getAllByRole('spinbutton')
    await user.type(spinbuttons[0]!, '150')
    await user.type(screen.getByLabelText('Every'), '4')
    await user.selectOptions(screen.getByLabelText('Unit'), 'weeks')
    await fireEvent.input(screen.getByLabelText('Next due'), { target: { value: '2026-10-01' } })
    await user.selectOptions(screen.getByLabelText('Category'), 'Insurance')
    await user.click(screen.getByRole('button', { name: 'Add bill' }))

    await waitFor(() =>
      expect(createRecurringBill).toHaveBeenCalledWith({
        name: 'Termite Check',
        amount: 150,
        frequency: 'custom',
        customIntervalValue: 4,
        customIntervalUnit: 'weeks',
        nextDueOn: '2026-10-01',
        categoryId: 1,
      })
    )
  })

  it('shows an API error when adding a bill fails', async () => {
    setDefaultMocks()
    vi.mocked(createRecurringBill).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.type(await screen.findByPlaceholderText('e.g. Netflix'), 'Car Insurance')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '600')
    await fireEvent.input(screen.getByLabelText('Next due'), { target: { value: '2026-08-01' } })
    await user.click(screen.getByRole('button', { name: 'Add bill' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('edits a bill: changing name and amount, saving, and reloading', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockResolvedValue({ ...carInsurance, name: 'Car Insurance 2' })
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)

    const nameInput = screen.getByDisplayValue('Car Insurance')
    await user.clear(nameInput)
    await user.type(nameInput, 'Car Insurance 2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateRecurringBill).toHaveBeenCalledWith(1, {
        name: 'Car Insurance 2',
        amount: 600,
        frequency: 'annual',
        customIntervalValue: undefined,
        customIntervalUnit: undefined,
        nextDueOn: '2026-08-01',
      })
    )
    expect(listUpcomingRecurringBills).toHaveBeenCalledTimes(2)
  })

  it('switches an edited bill to a custom frequency and shows the interval inputs', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockResolvedValue(pestControl)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)

    const row = screen.getByDisplayValue('Car Insurance').closest('tr')!
    const frequencySelect = within(row).getAllByRole('combobox')[1]!
    await user.selectOptions(frequencySelect, 'custom')

    const intervalInputs = within(row).getAllByRole('spinbutton')
    await user.clear(intervalInputs[1]!)
    await user.type(intervalInputs[1]!, '6')
    const unitSelect = within(row).getAllByRole('combobox')[2]!
    await user.selectOptions(unitSelect, 'days')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateRecurringBill).toHaveBeenCalledWith(1, {
        name: 'Car Insurance',
        amount: 600,
        frequency: 'custom',
        customIntervalValue: 6,
        customIntervalUnit: 'days',
        nextDueOn: '2026-08-01',
      })
    )
  })

  it('cancels an edit without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    expect(screen.getByDisplayValue('Car Insurance')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByDisplayValue('Car Insurance')).toBeNull()
    expect(updateRecurringBill).not.toHaveBeenCalled()
  })

  it('shows a validation error when editing to a blank name', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    await user.clear(screen.getByDisplayValue('Car Insurance'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Name, amount, and next due date are required')
    ).toBeInTheDocument()
    expect(updateRecurringBill).not.toHaveBeenCalled()
  })

  it('shows an API error when saving an edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockRejectedValue(new ApiError(500, 'Could not save'))
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await screen.findByText('Car Insurance')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
  })
})
