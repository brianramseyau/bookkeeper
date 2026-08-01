import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { getDashboardSummary } from './dashboard'

vi.mock('$lib/api', () => ({ api: { get: vi.fn() } }))

describe('dashboard api', () => {
  it('gets the dashboard summary for a given year/month', () => {
    getDashboardSummary(2026, 3)
    expect(api.get).toHaveBeenCalledWith('/dashboard/summary?year=2026&month=3')
  })
})
