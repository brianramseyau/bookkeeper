import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createRecurringBill,
  deleteRecurringBill,
  listUpcomingRecurringBills,
  updateRecurringBill,
} from './recurring-bills'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('recurring bills api', () => {
  it('lists upcoming recurring bills', () => {
    listUpcomingRecurringBills()
    expect(api.get).toHaveBeenCalledWith('/recurring-bills/upcoming')
  })

  it('creates a recurring bill', () => {
    createRecurringBill({
      name: 'Costco',
      amount: 65,
      frequency: 'annual',
      nextDueOn: '2026-01-31',
    })
    expect(api.post).toHaveBeenCalledWith('/recurring-bills', {
      name: 'Costco',
      amount: 65,
      frequency: 'annual',
      nextDueOn: '2026-01-31',
    })
  })

  it('updates a recurring bill', () => {
    updateRecurringBill(4, { amount: 70 })
    expect(api.patch).toHaveBeenCalledWith('/recurring-bills/4', { amount: 70 })
  })

  it('deletes a recurring bill', () => {
    deleteRecurringBill(4)
    expect(api.delete).toHaveBeenCalledWith('/recurring-bills/4')
  })
})
