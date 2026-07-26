import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { getDashboardSummary } from './dashboard'

vi.mock('$lib/api', () => ({ api: { get: vi.fn() } }))

describe('dashboard api', () => {
  it('gets the dashboard summary', () => {
    getDashboardSummary()
    expect(api.get).toHaveBeenCalledWith('/dashboard/summary')
  })
})
