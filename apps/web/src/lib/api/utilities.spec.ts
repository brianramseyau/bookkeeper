import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createUtility,
  deleteUtilityBill,
  getUtilityBills,
  getUtilityTrend,
  listUtilities,
  updateUtility,
  upsertUtilityBill,
} from './utilities'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('utilities api', () => {
  it('lists utilities', () => {
    listUtilities()
    expect(api.get).toHaveBeenCalledWith('/utilities')
  })

  it('creates a utility', () => {
    createUtility('Electricity')
    expect(api.post).toHaveBeenCalledWith('/utilities', { name: 'Electricity' })
  })

  it('updates a utility', () => {
    updateUtility(1, { frequency: 'quarterly' })
    expect(api.patch).toHaveBeenCalledWith('/utilities/1', { frequency: 'quarterly' })
  })

  it('gets a utility bills matrix', () => {
    getUtilityBills(1)
    expect(api.get).toHaveBeenCalledWith('/utilities/1/bills')
  })

  it('gets a utility trend', () => {
    getUtilityTrend(1)
    expect(api.get).toHaveBeenCalledWith('/utilities/1/trend')
  })

  it('upserts a utility bill', () => {
    upsertUtilityBill(1, 2026, 3, 409.08)
    expect(api.put).toHaveBeenCalledWith('/utilities/1/bills/2026/3', { amount: 409.08 })
  })

  it('deletes a utility bill', () => {
    deleteUtilityBill(9)
    expect(api.delete).toHaveBeenCalledWith('/utility-bills/9')
  })
})
