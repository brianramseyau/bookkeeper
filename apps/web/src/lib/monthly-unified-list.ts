import type { StandardMonthLine, StandardMonthIncomeLine } from './api/standard-month'
import type { IncomeEntry } from './api/income'
import { resolveDueDate } from './standard-month-line'
import { type IncomeRow, incomeRowsForLine } from './income-rows'

export type UnifiedListItem =
  | { type: 'outgoing'; key: string; date: string | null; line: StandardMonthLine }
  | {
      type: 'income'
      key: string
      date: string | null
      line: StandardMonthIncomeLine
      row: IncomeRow
    }

/**
 * Merges the Outgoing lines and Incoming rows (both `actual` and
 * `placeholder`, across every income line) into one array ordered by
 * resolved date, for Monthly's unified list (see PLAN_02_PHASE_01).
 *
 * Items are built in a fixed base order - expense lines in `data.expenses.
 * lines`' own order, then income rows in `data.income.lines`' own order -
 * and then stably sorted by date, undated last. This is the same tie-break
 * `+page.svelte`'s old `sortedExpenseLines` used for outgoing-outgoing
 * ties, generalized (via a stable sort) to outgoing/income and
 * income/income ties too, rather than inventing a new rule.
 */
export function buildUnifiedList(
  expenseLines: StandardMonthLine[],
  incomeLines: StandardMonthIncomeLine[],
  entries: IncomeEntry[],
  year: number,
  month: number
): UnifiedListItem[] {
  const items: UnifiedListItem[] = []

  for (const line of expenseLines) {
    items.push({
      type: 'outgoing',
      key: line.key,
      date: resolveDueDate(line, year, month),
      line,
    })
  }

  for (const line of incomeLines) {
    for (const row of incomeRowsForLine(entries, line)) {
      const date = row.type === 'actual' ? (row.entry.receivedOn ?? null) : row.date
      items.push({ type: 'income', key: row.key, date, line, row })
    }
  }

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aDate = a.item.date
      const bDate = b.item.date
      if (aDate && bDate) return new Date(aDate).getTime() - new Date(bDate).getTime()
      if (aDate) return -1
      if (bDate) return 1
      return a.index - b.index
    })
    .map(({ item }) => item)
}
