import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUtility, getUtilityTrend, listUtilities, type Utility } from '$lib/api/utilities'
import { ApiError } from '$lib/api'
import UtilitiesPage from './+page.svelte'

vi.mock('$lib/api/utilities', () => ({
  listUtilities: vi.fn(),
  getUtilityTrend: vi.fn(),
  createUtility: vi.fn(),
}))

const electricity: Utility = {
  id: 1,
  name: 'Electricity',
  categoryId: null,
  frequency: 'monthly',
  dueOffsetDays: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}

describe('utilities page', () => {
  beforeEach(() => {
    vi.mocked(listUtilities).mockReset()
    vi.mocked(getUtilityTrend).mockReset()
    vi.mocked(createUtility).mockReset()
  })

  it('shows a loading state, then an error on failure', async () => {
    vi.mocked(listUtilities).mockRejectedValue(new ApiError(500, 'Could not load utilities'))
    render(UtilitiesPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Could not load utilities')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(listUtilities).mockRejectedValue(new Error('boom'))
    render(UtilitiesPage)
    expect(await screen.findByText('Failed to load utilities')).toBeInTheDocument()
  })

  it('shows a placeholder when a utility has no recorded bills', async () => {
    vi.mocked(listUtilities).mockResolvedValue([electricity])
    vi.mocked(getUtilityTrend).mockResolvedValue({
      average: null,
      latestAmount: null,
      latestYear: null,
      latestMonth: null,
      trend: null,
      months: [],
    })
    render(UtilitiesPage)

    expect(await screen.findByText('No bills recorded yet')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Electricity/ })
    expect(link.getAttribute('href')).toBe('/utilities/1')
  })

  it.each([
    ['up', '▲ up on trailing average'],
    ['down', '▼ down on trailing average'],
    ['flat', '— flat'],
  ] as const)('shows the %s trend indicator', async (trend, label) => {
    vi.mocked(listUtilities).mockResolvedValue([electricity])
    vi.mocked(getUtilityTrend).mockResolvedValue({
      average: 100,
      latestAmount: 110,
      latestYear: 2026,
      latestMonth: 3,
      trend,
      months: [],
    })
    render(UtilitiesPage)

    expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.getByText('$110.00')).toBeInTheDocument()
    expect(screen.getByText('12-mo avg: $100.00')).toBeInTheDocument()
  })

  it('adds a new utility and reloads the list', async () => {
    vi.mocked(listUtilities).mockResolvedValue([])
    vi.mocked(createUtility).mockResolvedValue({ ...electricity, name: 'Internet' })
    const user = userEvent.setup()
    render(UtilitiesPage)

    await screen.findByPlaceholderText('Add a utility (e.g. Internet)')
    vi.mocked(listUtilities).mockResolvedValue([{ ...electricity, name: 'Internet' }])
    vi.mocked(getUtilityTrend).mockResolvedValue({
      average: null,
      latestAmount: null,
      latestYear: null,
      latestMonth: null,
      trend: null,
      months: [],
    })

    await user.type(screen.getByPlaceholderText('Add a utility (e.g. Internet)'), 'Internet')
    await user.click(screen.getByRole('button', { name: 'Add utility' }))

    expect(createUtility).toHaveBeenCalledWith('Internet')
    expect(await screen.findByText('Internet')).toBeInTheDocument()
  })

  it('does not submit an empty or whitespace-only utility name', async () => {
    vi.mocked(listUtilities).mockResolvedValue([])
    const user = userEvent.setup()
    render(UtilitiesPage)

    await user.click(await screen.findByRole('button', { name: 'Add utility' }))

    expect(createUtility).not.toHaveBeenCalled()
  })

  it('shows an error when adding a utility fails', async () => {
    vi.mocked(listUtilities).mockResolvedValue([])
    vi.mocked(createUtility).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(UtilitiesPage)

    await user.type(await screen.findByPlaceholderText('Add a utility (e.g. Internet)'), 'Water')
    await user.click(screen.getByRole('button', { name: 'Add utility' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })
})
