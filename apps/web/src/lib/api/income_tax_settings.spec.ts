import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { getIncomeTaxSetting, setIncomeTaxSetting } from './income_tax_settings'

vi.mock('$lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))

describe('income tax settings api', () => {
  it('gets the marginal rate for a user/financial year', () => {
    getIncomeTaxSetting(1, 2026)
    expect(api.get).toHaveBeenCalledWith('/income-tax-settings?userId=1&financialYear=2026')
  })

  it('sets the marginal rate for a user/financial year', () => {
    setIncomeTaxSetting(1, 2026, 0.37)
    expect(api.put).toHaveBeenCalledWith('/income-tax-settings', {
      userId: 1,
      financialYear: 2026,
      marginalRate: 0.37,
    })
  })
})
