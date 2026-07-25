import { api } from '$lib/api'

export interface StandardMonthLine {
  key: string
  label: string
  projected: number
  actual: number | null
  dueDay: number | null
}

export interface StandardMonthIncomeLine {
  key: string
  label: string
  projected: number
  actual: number
}

export interface StandardMonthResult {
  year: number
  month: number
  carryover: number
  income: {
    lines: StandardMonthIncomeLine[]
    projectedTotal: number
    actualTotal: number
  }
  expenses: {
    lines: StandardMonthLine[]
    projectedTotal: number
    actualTotal: number
  }
  projectedNet: number
  actualNet: number
}

export function getStandardMonth(year: number, month: number) {
  return api.get<StandardMonthResult>(`/standard-month?year=${year}&month=${month}`)
}
