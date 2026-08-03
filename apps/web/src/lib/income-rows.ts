import type { IncomeEntry } from './api/income'
import type { StandardMonthIncomeLine } from './api/standard-month'
import { formatDate, round2 } from './format'

// Sourced lines with the projected 1-2 (occasionally 3) pay dates for the
// month pair each already-logged entry with a pay date positionally, in
// chronological order - the common case where entries are logged roughly
// in the order they're paid. Any pay date left over becomes a placeholder
// row; any entry left over (more entries than known pay dates) just
// renders as a normal extra row with no aligned projected figure.
// Unattributed ("Other income") lines always have no pay dates, so they
// only ever produce 'actual' rows here, unchanged from before.
export type IncomeRow =
  | { type: 'actual'; key: string; entry: IncomeEntry; projected: number | null }
  | { type: 'placeholder'; key: string; date: string; projected: number }

// An unattributed ("Other income") line is per-person - the match needs
// the line's userId too, or two people's unattributed lines would each
// render every unattributed entry regardless of whose it is.
export function entriesForLine(
  entries: IncomeEntry[],
  line: StandardMonthIncomeLine
): IncomeEntry[] {
  return entries
    .filter((entry) =>
      line.sourceId !== null
        ? entry.incomeSourceId === line.sourceId
        : entry.incomeSourceId === null && entry.userId === line.userId
    )
    .sort((a, b) => (a.receivedOn ?? '').localeCompare(b.receivedOn ?? ''))
}

export function incomeRowsForLine(
  entries: IncomeEntry[],
  line: StandardMonthIncomeLine
): IncomeRow[] {
  const lineEntries = entriesForLine(entries, line)
  const perPeriod = line.payDates.length > 0 ? round2(line.projected / line.payDates.length) : null
  const rows: IncomeRow[] = []
  const count = Math.max(lineEntries.length, line.payDates.length)
  for (let i = 0; i < count; i++) {
    const date = line.payDates[i]
    if (i < lineEntries.length) {
      const entry = lineEntries[i]!
      rows.push({
        type: 'actual',
        key: `entry-${entry.id}`,
        entry,
        projected: date !== undefined ? perPeriod : null,
      })
    } else if (date !== undefined) {
      rows.push({
        type: 'placeholder',
        key: `placeholder-${line.key}-${date}`,
        date,
        projected: perPeriod!,
      })
    }
  }
  return rows
}

export function entryRowLabel(entry: IncomeEntry): string {
  return entry.receivedOn ? `entry from ${formatDate(entry.receivedOn)}` : 'entry'
}
