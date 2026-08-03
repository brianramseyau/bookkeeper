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
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const carInsurance: UpcomingRecurringBill = {
  id: 1,
  name: 'Car Insurance',
  categoryId: 1,
  amount: 600,
  frequency: 'annual',
  dueDay: null,
  dueMonth: null,
  nextDueOn: '2026-08-01T00:00:00.000+00:00',
  isActive: true,
  isPaused: false,
  isArchived: false,
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
  frequency: 'quarterly',
  dueDay: null,
  dueMonth: null,
  nextDueOn: '2026-07-20T00:00:00.000+00:00',
  isActive: true,
  isPaused: false,
  isArchived: false,
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
  dueDay: null,
  dueMonth: null,
  nextDueOn: '2026-09-01T00:00:00.000+00:00',
  isActive: true,
  isPaused: false,
  isArchived: false,
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
    expect(within(pestRow).getByText('Quarterly')).toBeInTheDocument()
    expect(within(gymRow).getByText('Monthly')).toBeInTheDocument()

    expect(within(carRow).getByText(formatDate(carInsurance.nextDueOn))).toBeInTheDocument()
    expect(within(pestRow).getByText(formatDate(pestControl.nextDueOn))).toBeInTheDocument()

    const dueSoonBadge = screen.getByText(formatDaysUntilDue(5))
    expect(dueSoonBadge.className).toContain('bg-amber-100')
    const overdueBadge = screen.getByText(formatDaysUntilDue(-3))
    expect(overdueBadge.className).toContain('bg-red-100')

    const gymDue = within(gymRow).getByText(formatDaysUntilDue(37))
    expect(gymDue.className).not.toContain('bg-amber-100')
    expect(gymDue.className).not.toContain('bg-red-100')
  })

  it('gives each active bill row a bill-{id} anchor so the Monthly page can link to it', async () => {
    setDefaultMocks()
    render(RecurringBillsPage)

    const carRow = await screen.findByText('Car Insurance').then((el) => el.closest('tr')!)
    expect(carRow.id).toBe(`bill-${carInsurance.id}`)
  })

  it('flashes the row landed on via a #bill-{id} hash link', async () => {
    window.location.hash = `#bill-${pestControl.id}`
    try {
      setDefaultMocks()
      render(RecurringBillsPage)

      const pestRow = await screen.findByText('Pest Control').then((el) => el.closest('tr')!)
      await waitFor(() => expect(pestRow.classList).toContain('highlight-flash'))
      const carRow = screen.getByText('Car Insurance').closest('tr')!
      expect(carRow.classList).not.toContain('highlight-flash')
    } finally {
      window.location.hash = ''
    }
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

  it('does not offer Remove on an active or paused bill, only once archived', async () => {
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isPaused: true },
      pestControl,
      gym,
    ])
    vi.mocked(listCategories).mockResolvedValue([insurance])
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Car Insurance')
    expect(screen.queryByRole('button', { name: 'Delete Car Insurance' })).toBeNull()
  })

  it('permanently removes an archived bill after confirming', async () => {
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isArchived: true },
      pestControl,
      gym,
    ])
    vi.mocked(listCategories).mockResolvedValue([insurance])
    vi.mocked(deleteRecurringBill).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Car Insurance')
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([pestControl, gym])
    await user.click(screen.getAllByRole('button', { name: 'Delete Car Insurance' })[0]!)

    expect(window.confirm).toHaveBeenCalledWith(
      'Permanently delete "Car Insurance"? This cannot be undone.'
    )
    expect(deleteRecurringBill).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Car Insurance')).toBeNull())
  })

  it('does not remove an archived bill when the confirmation is declined', async () => {
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isArchived: true },
      pestControl,
      gym,
    ])
    vi.mocked(listCategories).mockResolvedValue([insurance])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click((await screen.findAllByRole('button', { name: 'Delete Car Insurance' }))[0]!)

    expect(deleteRecurringBill).not.toHaveBeenCalled()
  })

  it('shows an error when permanently removing an archived bill fails', async () => {
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isArchived: true },
      pestControl,
      gym,
    ])
    vi.mocked(listCategories).mockResolvedValue([insurance])
    vi.mocked(deleteRecurringBill).mockRejectedValue(new ApiError(500, 'Could not delete'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click((await screen.findAllByRole('button', { name: 'Delete Car Insurance' }))[0]!)

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
        nextDueOn: '2026-09-15',
        categoryId: undefined,
      })
    )
    expect(listUpcomingRecurringBills).toHaveBeenCalledTimes(2)
  })

  it('adds a quarterly bill', async () => {
    setDefaultMocks()
    vi.mocked(createRecurringBill).mockResolvedValue(pestControl)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.type(await screen.findByPlaceholderText('e.g. Netflix'), 'Termite Check')
    await user.selectOptions(screen.getByLabelText('Frequency'), 'quarterly')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '150')
    await fireEvent.input(screen.getByLabelText('Next due'), { target: { value: '2026-10-01' } })
    await user.selectOptions(screen.getByLabelText('Category'), 'Insurance')
    await user.click(screen.getByRole('button', { name: 'Add bill' }))

    await waitFor(() =>
      expect(createRecurringBill).toHaveBeenCalledWith({
        name: 'Termite Check',
        amount: 150,
        frequency: 'quarterly',
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

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    await user.click(within(carRow).getAllByRole('button', { name: 'Edit Car Insurance' })[0]!)

    const nameInput = screen.getByDisplayValue('Car Insurance')
    await user.clear(nameInput)
    await user.type(nameInput, 'Car Insurance 2')
    await user.click(screen.getByRole('button', { name: 'Save Car Insurance' }))

    await waitFor(() =>
      expect(updateRecurringBill).toHaveBeenCalledWith(1, {
        name: 'Car Insurance 2',
        amount: 600,
        frequency: 'annual',
        nextDueOn: '2026-08-01',
      })
    )
    expect(listUpcomingRecurringBills).toHaveBeenCalledTimes(2)
  })

  it('switches an edited bill to a different frequency', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockResolvedValue(pestControl)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    await user.click(within(carRow).getAllByRole('button', { name: 'Edit Car Insurance' })[0]!)

    const row = screen.getByDisplayValue('Car Insurance').closest('tr')!
    const frequencySelect = within(row).getAllByRole('combobox')[1]!
    await user.selectOptions(frequencySelect, 'quarterly')

    await user.click(screen.getByRole('button', { name: 'Save Car Insurance' }))

    await waitFor(() =>
      expect(updateRecurringBill).toHaveBeenCalledWith(1, {
        name: 'Car Insurance',
        amount: 600,
        frequency: 'quarterly',
        nextDueOn: '2026-08-01',
      })
    )
  })

  it('cancels an edit without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    await user.click(within(carRow).getAllByRole('button', { name: 'Edit Car Insurance' })[0]!)
    expect(screen.getByDisplayValue('Car Insurance')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel editing Car Insurance' }))

    expect(screen.queryByDisplayValue('Car Insurance')).toBeNull()
    expect(updateRecurringBill).not.toHaveBeenCalled()
  })

  it('shows a validation error when editing to a blank name', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    await user.click(within(carRow).getAllByRole('button', { name: 'Edit Car Insurance' })[0]!)
    await user.clear(screen.getByDisplayValue('Car Insurance'))
    await user.click(screen.getByRole('button', { name: 'Save Car Insurance' }))

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

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    await user.click(within(carRow).getAllByRole('button', { name: 'Edit Car Insurance' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Save Car Insurance' }))

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
  })

  it('pauses a bill, hiding it from the default list until "Show hidden" is toggled', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockResolvedValue({ ...carInsurance, isPaused: true })
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isPaused: true },
      pestControl,
      gym,
    ])
    await user.click(within(carRow).getAllByRole('button', { name: 'Pause Car Insurance' })[0]!)

    expect(updateRecurringBill).toHaveBeenCalledWith(1, { isPaused: true })
    await waitFor(() => expect(screen.queryByText('Car Insurance')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Show paused / archived / removed' }))
    expect(screen.getByText('Car Insurance')).toBeInTheDocument()
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
  })

  it('archives a bill and can unarchive it', async () => {
    setDefaultMocks()
    vi.mocked(updateRecurringBill).mockResolvedValue({ ...carInsurance, isArchived: true })
    const user = userEvent.setup()
    render(RecurringBillsPage)

    const carRow = (await screen.findByText('Car Insurance')).closest('tr')!
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isArchived: true },
      pestControl,
      gym,
    ])
    await user.click(within(carRow).getAllByRole('button', { name: 'Archive Car Insurance' })[0]!)

    expect(updateRecurringBill).toHaveBeenCalledWith(1, { isArchived: true })
    await waitFor(() => expect(screen.queryByText('Car Insurance')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Show paused / archived / removed' }))
    await screen.findByText('Car Insurance')

    vi.mocked(updateRecurringBill).mockResolvedValue(carInsurance)
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([carInsurance, pestControl, gym])
    await user.click(screen.getAllByRole('button', { name: 'Unarchive Car Insurance' })[0]!)

    expect(updateRecurringBill).toHaveBeenCalledWith(1, { isArchived: false })
  })

  it('restores a removed bill', async () => {
    setDefaultMocks()
    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([
      { ...carInsurance, isActive: false },
      pestControl,
      gym,
    ])
    vi.mocked(updateRecurringBill).mockResolvedValue(carInsurance)
    const user = userEvent.setup()
    render(RecurringBillsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await waitFor(() => expect(screen.getAllByText('Removed').length).toBeGreaterThan(0))

    vi.mocked(listUpcomingRecurringBills).mockResolvedValue([carInsurance, pestControl, gym])
    await user.click(screen.getAllByRole('button', { name: 'Restore Car Insurance' })[0]!)

    expect(updateRecurringBill).toHaveBeenCalledWith(1, { isActive: true })
  })
})
