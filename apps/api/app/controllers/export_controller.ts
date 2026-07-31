import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import Category from '#models/category'
import Expense from '#models/expense'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import UserSubscription from '#models/user_subscription'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'

const TABLES: Record<string, LucidModel> = {
  'categories': Category,
  'expenses': Expense,
  'utilities': Utility,
  'utility-bills': UtilityBill,
  'recurring-bills': RecurringBill,
  'subscriptions': UserSubscription,
  'expense-actuals': ExpenseMonthlyActual,
  'income-sources': IncomeSource,
  'income-entries': IncomeEntry,
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''

  const columns = Object.keys(rows[0]!)
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((column) => escape(row[column])).join(','))
  }
  return lines.join('\n')
}

export default class ExportController {
  async json({ response }: HttpContext) {
    const data: Record<string, unknown[]> = {}
    for (const [name, model] of Object.entries(TABLES)) {
      const rows = await model.query()
      data[name] = rows.map((row) => row.serialize())
    }

    const date = new Date().toISOString().slice(0, 10)
    response.header('Content-Type', 'application/json')
    response.header('Content-Disposition', `attachment; filename="bookkeeper-export-${date}.json"`)
    return response.send(JSON.stringify(data, null, 2))
  }

  async csv({ params, response }: HttpContext) {
    const table = params.table as string
    const model = TABLES[table]
    if (!model) {
      return response.notFound({ message: `Unknown export table "${table}"` })
    }

    const rows = await model.query()
    const csv = toCsv(rows.map((row) => row.serialize()))

    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header('Content-Disposition', `attachment; filename="${table}.csv"`)
    return response.send(csv)
  }
}
