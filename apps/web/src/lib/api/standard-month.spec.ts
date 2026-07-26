import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { getStandardMonth } from './standard-month'

vi.mock('$lib/api', () => ({ api: { get: vi.fn() } }))

describe('standard month api', () => {
  it('gets the standard month for a year/month', () => {
    getStandardMonth(2026, 3)
    expect(api.get).toHaveBeenCalledWith('/standard-month?year=2026&month=3')
  })
})
