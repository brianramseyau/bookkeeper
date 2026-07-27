import { api } from '$lib/api'

export interface IncomeTaxSetting {
  userId: number
  financialYear: number
  marginalRate: number | null
}

export function getIncomeTaxSetting(userId: number, financialYear: number) {
  return api.get<IncomeTaxSetting>(
    `/income-tax-settings?userId=${userId}&financialYear=${financialYear}`
  )
}

export function setIncomeTaxSetting(userId: number, financialYear: number, marginalRate: number) {
  return api.put<IncomeTaxSetting>('/income-tax-settings', { userId, financialYear, marginalRate })
}
