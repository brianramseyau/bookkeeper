import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { setMonthCarryover } from './month-carryover'

vi.mock('$lib/api', () => ({ api: { put: vi.fn() } }))

describe('month carryover api', () => {
  it('sets the carryover amount for a year/month', () => {
    setMonthCarryover(2026, 3, 150.5)
    expect(api.put).toHaveBeenCalledWith('/month-carryovers/2026/3', { amount: 150.5 })
  })
})
