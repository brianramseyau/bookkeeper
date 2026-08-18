import { api } from '$lib/api'

export interface DashboardUpcomingBill {
  id: number
  name: string
  amount: number
  nextDueOn: string | null
  daysUntilDue: number | null
}

export interface DashboardMonthlyExpense {
  year: number
  month: number
  total: number
}

export interface DashboardCategoryBreakdown {
  id: number
  name: string
  color: string | null
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
  monthlyExpenses: DashboardMonthlyExpense[]
  categoryBreakdown: DashboardCategoryBreakdown[]
  /** Net household income over the same 12-month window as monthlyExpenses. */
  totalIncome: number
}

export function getDashboardSummary(year: number, month: number) {
  return api.get<DashboardSummary>(`/dashboard/summary?year=${year}&month=${month}`)
}
