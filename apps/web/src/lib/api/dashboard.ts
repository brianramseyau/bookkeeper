import { api } from '$lib/api'

export interface DashboardUpcomingBill {
  id: number
  name: string
  amount: number
  nextDueOn: string | null
  daysUntilDue: number | null
}

export interface DashboardUtility {
  id: number
  name: string
  latestAmount: number | null
  average: number | null
  trend: 'up' | 'down' | 'flat' | null
  sparkline: number[]
}

export interface DashboardMonthlyExpense {
  year: number
  month: number
  total: number
}

export interface DashboardSummary {
  currentMonth: {
    year: number
    month: number
    projectedNet: number
    actualNet: number
  }
  upcomingBills: DashboardUpcomingBill[]
  utilities: DashboardUtility[]
  monthlyExpenses: DashboardMonthlyExpense[]
}

export function getDashboardSummary() {
  return api.get<DashboardSummary>('/dashboard/summary')
}
