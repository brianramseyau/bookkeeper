import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeEntry } from '$lib/api/income'
import IncomeEntryDisplayRow from './IncomeEntryDisplayRow.svelte'

function makeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 10,
    incomeSourceId: 1,
    userId: null,
    year: 2026,
    month: 3,
    receivedOn: '2026-03-14T00:00:00.000+00:00',
    amount: 5000,
    note: 'March pay',
    taxWithheld: null,
    ...overrides,
  }
}

describe('IncomeEntryDisplayRow', () => {
  it('renders the date, amount and note, with no projected column by default', () => {
    render(IncomeEntryDisplayRow, { entry: makeEntry(), onEdit: vi.fn(), onDelete: vi.fn() })

    expect(screen.getByText('14 Mar 2026')).toBeInTheDocument()
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('March pay').length).toBeGreaterThan(0)
    expect(screen.queryByText('Projected')).toBeNull()
  })

  it('renders an em dash when there is no note', () => {
    render(IncomeEntryDisplayRow, {
      entry: makeEntry({ note: null }),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    })

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders a projected column when the prop is given', () => {
    render(IncomeEntryDisplayRow, {
      entry: makeEntry(),
      projected: 2500,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    })

    expect(screen.getAllByText('Projected').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$2,500.00').length).toBeGreaterThan(0)
  })

  it('renders the leading snippet, passed the entry', () => {
    const leading = createRawSnippet((entry: () => IncomeEntry) => ({
      render: () => `<td>Owner: ${entry().id}</td>`,
    }))
    render(IncomeEntryDisplayRow, {
      entry: makeEntry(),
      leading,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    })

    expect(screen.getByText('Owner: 10')).toBeInTheDocument()
  })

  it('calls onEdit/onDelete with the entry', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const entry = makeEntry()
    const user = userEvent.setup()
    render(IncomeEntryDisplayRow, { entry, onEdit, onDelete })

    await user.click(screen.getAllByRole('button', { name: /^Edit entry from/ })[0]!)
    expect(onEdit).toHaveBeenCalledWith(entry)

    await user.click(screen.getAllByRole('button', { name: /^Delete entry from/ })[0]!)
    expect(onDelete).toHaveBeenCalledWith(entry)
  })
})
