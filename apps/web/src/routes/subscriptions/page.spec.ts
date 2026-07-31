import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSubscription,
  deleteSubscription,
  getSubscriptionsSummary,
  listSubscriptions,
  updateSubscription,
  type SubscriptionSummary,
  type UserSubscription,
} from '$lib/api/subscriptions'
import { listUsers, type UserSummary } from '$lib/api/users'
import { listCategories, type Category } from '$lib/api/categories'
import { ApiError } from '$lib/api'
import SubscriptionsPage from './+page.svelte'

vi.mock('$lib/api/subscriptions', () => ({
  listSubscriptions: vi.fn(),
  getSubscriptionsSummary: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn() }))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn() }))

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

const streaming: Category = {
  id: 1,
  name: 'Streaming',
  color: null,
  sortOrder: 0,
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const netflix: UserSubscription = {
  id: 1,
  userId: 1,
  name: 'Netflix',
  categoryId: 1,
  amount: 15.99,
  dayOfMonth: 5,
  includeInStandardMonth: true,
  isActive: true,
  isPaused: false,
  isArchived: false,
  notes: null,
  createdAt: '',
  updatedAt: '',
}
const spotify: UserSubscription = {
  id: 2,
  userId: 1,
  name: 'Spotify',
  categoryId: null,
  amount: 9.99,
  dayOfMonth: null,
  includeInStandardMonth: true,
  isActive: true,
  isPaused: false,
  isArchived: false,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

const summaries: SubscriptionSummary[] = [
  { userId: 1, fullName: 'Brian', total: 25.98, count: 2 },
  { userId: 2, fullName: 'Ariel', total: 0, count: 0 },
]

function setDefaultMocks() {
  vi.mocked(listUsers).mockResolvedValue([brian, ariel])
  vi.mocked(getSubscriptionsSummary).mockResolvedValue(summaries)
  vi.mocked(listCategories).mockResolvedValue([streaming])
  vi.mocked(listSubscriptions).mockResolvedValue([netflix, spotify])
}

describe('subscriptions page', () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockReset()
    vi.mocked(getSubscriptionsSummary).mockReset()
    vi.mocked(listCategories).mockReset()
    vi.mocked(listSubscriptions).mockReset()
    vi.mocked(createSubscription).mockReset()
    vi.mocked(updateSubscription).mockReset()
    vi.mocked(deleteSubscription).mockReset()
  })

  it('shows a loading state, then an API error on failure', async () => {
    vi.mocked(listUsers).mockRejectedValue(new ApiError(500, 'Could not load users'))
    vi.mocked(getSubscriptionsSummary).mockResolvedValue([])
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(listSubscriptions).mockResolvedValue([])
    render(SubscriptionsPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Could not load users')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(listUsers).mockRejectedValue(new Error('boom'))
    vi.mocked(getSubscriptionsSummary).mockResolvedValue([])
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(listSubscriptions).mockResolvedValue([])
    render(SubscriptionsPage)
    expect(await screen.findByText('Failed to load subscriptions')).toBeInTheDocument()
  })

  it('shows no user tiles or table when there are no users', async () => {
    vi.mocked(listUsers).mockResolvedValue([])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue([])
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(listSubscriptions).mockResolvedValue([])
    render(SubscriptionsPage)

    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: /Add subscription/ })).toBeNull()
  })

  it('selects the first user by default and shows per-user summary tiles', async () => {
    setDefaultMocks()
    render(SubscriptionsPage)

    expect(await screen.findByText('$25.98/mo · 2 subscriptions')).toBeInTheDocument()
    expect(screen.getByText('$0.00/mo · 0 subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Spotify')).toBeInTheDocument()
  })

  it('shows the day of month, or a dash when unset', async () => {
    setDefaultMocks()
    render(SubscriptionsPage)

    await screen.findByText('Netflix')
    expect(screen.getByText('Day 5')).toBeInTheDocument()
    const spotifyRow = screen.getByText('Spotify').closest('tr')!
    expect(within(spotifyRow).getByText('—')).toBeInTheDocument()
  })

  it('shows "No subscriptions yet." for a user with none', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await screen.findByText('Netflix')
    await user.click(screen.getByText('Ariel'))

    expect(await screen.findByText('No subscriptions yet.')).toBeInTheDocument()
    expect(screen.queryByText('Netflix')).toBeNull()
  })

  it('changes a subscription category and reloads', async () => {
    setDefaultMocks()
    vi.mocked(updateSubscription).mockResolvedValue({ ...netflix, categoryId: null })
    const user = userEvent.setup()
    render(SubscriptionsPage)

    const row = (await screen.findByText('Netflix')).closest('tr')!
    const select = within(row).getByRole('combobox')
    await user.selectOptions(select, 'Uncategorized')

    expect(updateSubscription).toHaveBeenCalledWith(1, { categoryId: null })
    await waitFor(() => expect(listSubscriptions).toHaveBeenCalledTimes(2))
  })

  it('shows an error when changing category fails', async () => {
    setDefaultMocks()
    vi.mocked(updateSubscription).mockRejectedValue(new ApiError(500, 'Could not update category'))
    const user = userEvent.setup()
    render(SubscriptionsPage)

    const row = (await screen.findByText('Netflix')).closest('tr')!
    const select = within(row).getByRole('combobox')
    await user.selectOptions(select, 'Streaming')

    expect(await screen.findByText('Could not update category')).toBeInTheDocument()
  })

  it('does not offer Remove on an active or paused subscription, only once archived', async () => {
    vi.mocked(listUsers).mockResolvedValue([brian, ariel])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue(summaries)
    vi.mocked(listCategories).mockResolvedValue([streaming])
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isPaused: true }, spotify])
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Netflix')
    expect(screen.queryByRole('button', { name: 'Delete Netflix' })).toBeNull()
  })

  it('permanently removes an archived subscription after confirming', async () => {
    vi.mocked(listUsers).mockResolvedValue([brian, ariel])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue(summaries)
    vi.mocked(listCategories).mockResolvedValue([streaming])
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isArchived: true }, spotify])
    vi.mocked(deleteSubscription).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Netflix')
    vi.mocked(listSubscriptions).mockResolvedValue([spotify])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue([
      { userId: 1, fullName: 'Brian', total: 9.99, count: 1 },
      { userId: 2, fullName: 'Ariel', total: 0, count: 0 },
    ])
    await user.click(screen.getByRole('button', { name: 'Delete Netflix' }))

    expect(window.confirm).toHaveBeenCalledWith(
      'Permanently delete "Netflix"? This cannot be undone.'
    )
    expect(deleteSubscription).toHaveBeenCalledWith(1)
    expect(await screen.findByText('$9.99/mo · 1 subscription')).toBeInTheDocument()
    expect(screen.queryByText('Netflix')).toBeNull()
  })

  it('does not remove an archived subscription when the confirmation is declined', async () => {
    vi.mocked(listUsers).mockResolvedValue([brian, ariel])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue(summaries)
    vi.mocked(listCategories).mockResolvedValue([streaming])
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isArchived: true }, spotify])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click(await screen.findByRole('button', { name: 'Delete Netflix' }))

    expect(deleteSubscription).not.toHaveBeenCalled()
  })

  it('shows an error when permanently removing an archived subscription fails', async () => {
    vi.mocked(listUsers).mockResolvedValue([brian, ariel])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue(summaries)
    vi.mocked(listCategories).mockResolvedValue([streaming])
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isArchived: true }, spotify])
    vi.mocked(deleteSubscription).mockRejectedValue(new ApiError(500, 'Could not delete'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click(await screen.findByRole('button', { name: 'Delete Netflix' }))

    expect(await screen.findByText('Could not delete')).toBeInTheDocument()
  })

  it('requires a name and amount to add a subscription', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.click(await screen.findByRole('button', { name: 'Add subscription' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
    expect(createSubscription).not.toHaveBeenCalled()
  })

  it('adds a subscription and reloads the list', async () => {
    setDefaultMocks()
    vi.mocked(createSubscription).mockResolvedValue(netflix)
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.type(await screen.findByPlaceholderText('e.g. Spotify'), 'Disney+')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '12.99')
    await user.type(screen.getAllByRole('spinbutton')[1]!, '10')
    await user.selectOptions(screen.getByLabelText('Category'), 'Streaming')
    await user.click(screen.getByRole('button', { name: 'Add subscription' }))

    await waitFor(() =>
      expect(createSubscription).toHaveBeenCalledWith({
        userId: 1,
        name: 'Disney+',
        amount: 12.99,
        dayOfMonth: 10,
        categoryId: 1,
      })
    )
    expect(listSubscriptions).toHaveBeenCalledTimes(2)
  })

  it('shows an API error when adding a subscription fails', async () => {
    setDefaultMocks()
    vi.mocked(createSubscription).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.type(await screen.findByPlaceholderText('e.g. Spotify'), 'Netflix')
    await user.type(screen.getAllByRole('spinbutton')[0]!, '15.99')
    await user.click(screen.getByRole('button', { name: 'Add subscription' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('edits a subscription: changing name and amount, saving, and reloading', async () => {
    setDefaultMocks()
    vi.mocked(updateSubscription).mockResolvedValue({ ...netflix, name: 'Netflix Premium' })
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await screen.findByText('Netflix')
    await user.click(screen.getAllByRole('button', { name: 'Edit Netflix' })[0]!)

    const nameInput = screen.getByDisplayValue('Netflix')
    await user.clear(nameInput)
    await user.type(nameInput, 'Netflix Premium')
    await user.click(screen.getByRole('button', { name: 'Save Netflix' }))

    await waitFor(() =>
      expect(updateSubscription).toHaveBeenCalledWith(1, {
        name: 'Netflix Premium',
        amount: 15.99,
        dayOfMonth: 5,
      })
    )
    expect(listSubscriptions).toHaveBeenCalledTimes(2)
  })

  it('cancels an edit without saving', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await screen.findByText('Netflix')
    await user.click(screen.getAllByRole('button', { name: 'Edit Netflix' })[0]!)
    expect(screen.getByDisplayValue('Netflix')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel editing Netflix' }))

    expect(screen.queryByDisplayValue('Netflix')).toBeNull()
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('shows a validation error when editing to a blank name', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await screen.findByText('Netflix')
    await user.click(screen.getAllByRole('button', { name: 'Edit Netflix' })[0]!)
    await user.clear(screen.getByDisplayValue('Netflix'))
    await user.click(screen.getByRole('button', { name: 'Save Netflix' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
    expect(updateSubscription).not.toHaveBeenCalled()
  })

  it('shows an API error when saving an edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateSubscription).mockRejectedValue(new ApiError(500, 'Could not save'))
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await screen.findByText('Netflix')
    await user.click(screen.getAllByRole('button', { name: 'Edit Netflix' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Save Netflix' }))

    expect(await screen.findByText('Could not save')).toBeInTheDocument()
  })

  it('pauses a subscription, hiding it until "Show hidden" is toggled', async () => {
    setDefaultMocks()
    vi.mocked(updateSubscription).mockResolvedValue({ ...netflix, isPaused: true })
    const user = userEvent.setup()
    render(SubscriptionsPage)

    const row = (await screen.findByText('Netflix')).closest('tr')!
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isPaused: true }, spotify])
    await user.click(within(row).getByRole('button', { name: 'Pause Netflix' }))

    expect(updateSubscription).toHaveBeenCalledWith(1, { isPaused: true })
    await waitFor(() => expect(screen.queryByText('Netflix')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Show paused / archived / removed' }))
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
  })

  it('archives a subscription and can unarchive it', async () => {
    setDefaultMocks()
    vi.mocked(updateSubscription).mockResolvedValue({ ...netflix, isArchived: true })
    const user = userEvent.setup()
    render(SubscriptionsPage)

    const row = (await screen.findByText('Netflix')).closest('tr')!
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isArchived: true }, spotify])
    await user.click(within(row).getByRole('button', { name: 'Archive Netflix' }))

    expect(updateSubscription).toHaveBeenCalledWith(1, { isArchived: true })
    await waitFor(() => expect(screen.queryByText('Netflix')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Show paused / archived / removed' }))
    await screen.findByText('Netflix')

    vi.mocked(updateSubscription).mockResolvedValue(netflix)
    vi.mocked(listSubscriptions).mockResolvedValue([netflix, spotify])
    await user.click(screen.getByRole('button', { name: 'Unarchive Netflix' }))

    expect(updateSubscription).toHaveBeenCalledWith(1, { isArchived: false })
  })

  it('restores a removed subscription', async () => {
    vi.mocked(listUsers).mockResolvedValue([brian, ariel])
    vi.mocked(getSubscriptionsSummary).mockResolvedValue(summaries)
    vi.mocked(listCategories).mockResolvedValue([streaming])
    vi.mocked(listSubscriptions).mockResolvedValue([{ ...netflix, isActive: false }, spotify])
    vi.mocked(updateSubscription).mockResolvedValue(netflix)
    const user = userEvent.setup()
    render(SubscriptionsPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await waitFor(() => expect(screen.getAllByText('Removed').length).toBeGreaterThan(0))

    vi.mocked(listSubscriptions).mockResolvedValue([netflix, spotify])
    await user.click(screen.getByRole('button', { name: 'Restore Netflix' }))

    expect(updateSubscription).toHaveBeenCalledWith(1, { isActive: true })
  })
})
