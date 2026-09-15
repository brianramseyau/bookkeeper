import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UtilitiesPage from './+page.svelte'

vi.mock('$lib/api/utilities', () => ({
  listUtilities: vi.fn().mockResolvedValue([]),
  getUtilityTrend: vi.fn(),
  createUtility: vi.fn(),
  updateUtility: vi.fn(),
  deleteUtility: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Utilities page', () => {
  it('renders the shared outgoings list', async () => {
    render(UtilitiesPage)

    expect(await screen.findByRole('heading', { name: 'Utilities' })).toBeInTheDocument()
  })
})
