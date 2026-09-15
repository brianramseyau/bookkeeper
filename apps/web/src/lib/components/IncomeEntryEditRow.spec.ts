import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeEntry, IncomeSource } from '$lib/api/income'
import type { UserSummary } from '$lib/api/users'
import IncomeEntryEditRow, { type IncomeEntryEditTarget } from './IncomeEntryEditRow.svelte'

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}

function salarySource(): IncomeSource {
  return {
    id: 1,
    userId: 1,
    name: 'Brian Income',
    expectedAmount: 5000,
    frequency: 'monthly',
    payDayOfMonth: 14,
    weekendRollback: false,
    anchorDate: null,
    taxWithheld: true,
    isActive: true,
    notes: null,
  }
}

function sourcedEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
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

describe('IncomeEntryEditRow', () => {
  it('renders nothing when closed', () => {
    render(IncomeEntryEditRow, {
      props: {
        open: false,
        onOpenChange: vi.fn(),
        target: null,
        users: [],
        submitting: false,
        onSave: vi.fn(),
      },
    })

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('pre-fills fields from an existing sourced entry, with no owner/tax fields', () => {
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target: { type: 'entry', entry: sourcedEntry() },
        users: [brian],
        submitting: false,
        onSave: vi.fn(),
      },
    })

    expect(screen.getByDisplayValue('2026-03-14')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('March pay')).toBeInTheDocument()
    expect(screen.queryByLabelText('Owner')).toBeNull()
    expect(screen.queryByText('Tax withheld')).toBeNull()
  })

  it('shows owner and tax-withheld fields for an unattributed entry', () => {
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target: {
          type: 'entry',
          entry: sourcedEntry({ incomeSourceId: null, userId: 1, taxWithheld: true }),
        },
        users: [brian],
        submitting: false,
        onSave: vi.fn(),
      },
    })

    expect(screen.getByLabelText('Owner')).toHaveValue('1')
    expect(screen.getByText('Tax withheld')).toBeInTheDocument()
  })

  it('pre-fills from a placeholder pay date, with no owner/tax fields', () => {
    const target: IncomeEntryEditTarget = {
      type: 'placeholder',
      sourceId: 2,
      label: 'Ariel Income',
      date: '2026-03-18T00:00:00.000+00:00',
      projectedAmount: 866.67,
    }
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target,
        users: [],
        submitting: false,
        onSave: vi.fn(),
      },
    })

    expect(screen.getByDisplayValue('2026-03-18')).toBeInTheDocument()
    expect(screen.getByDisplayValue('866.67')).toBeInTheDocument()
    expect(screen.queryByLabelText('Owner')).toBeNull()
  })

  it('adds a salary entry: source picker, no owner/tax, "Log entry" button', async () => {
    const onSave = vi.fn()
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target: {
          type: 'new',
          kind: 'salary',
          sources: [salarySource()],
          userId: 1,
          receivedOn: '2026-03-15',
        },
        users: [brian],
        submitting: false,
        onSave,
      },
    })

    expect(screen.getByRole('heading', { name: 'Log salary', hidden: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Source')).toHaveValue('1')
    expect(screen.queryByLabelText('Owner')).toBeNull()
    expect(screen.queryByText('Tax withheld')).toBeNull()

    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '5000' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Log entry' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ incomeSourceId: 1, amount: 5000, receivedOn: '2026-03-15' })
    )
  })

  it('adds an other-income item: owner/tax fields, no source picker, "Add entry" button', () => {
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target: { type: 'new', kind: 'other', sources: [], userId: 1, receivedOn: '2026-03-15' },
        users: [brian],
        submitting: false,
        onSave: vi.fn(),
      },
    })

    expect(
      screen.getByRole('heading', { name: 'Add other income', hidden: true })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Source')).toBeNull()
    expect(screen.getByLabelText('Owner')).toHaveValue('1')
    expect(screen.getByText('Tax withheld')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeInTheDocument()
  })

  it('calls onSave with the edited values', async () => {
    const onSave = vi.fn()
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target: { type: 'entry', entry: sourcedEntry() },
        users: [brian],
        submitting: false,
        onSave,
      },
    })

    // fireEvent rather than userEvent throughout this test - a real
    // pointerdown on Drawer content hits vaul-svelte's drag-to-dismiss
    // handler, which needs setPointerCapture (unimplemented in jsdom).
    const amountInput = screen.getByDisplayValue('5000')
    await fireEvent.input(amountInput, { target: { value: '5500' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5500, receivedOn: '2026-03-14', note: 'March pay' })
    )
  })

  it('calls onOpenChange(false) from the Cancel button', async () => {
    const onOpenChange = vi.fn()
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange,
        target: { type: 'entry', entry: sourcedEntry() },
        users: [],
        submitting: false,
        onSave: vi.fn(),
      },
    })

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the error message when given one', () => {
    render(IncomeEntryEditRow, {
      props: {
        open: true,
        onOpenChange: vi.fn(),
        target: { type: 'entry', entry: sourcedEntry() },
        users: [],
        submitting: false,
        error: 'Amount is required',
        onSave: vi.fn(),
      },
    })

    expect(screen.getByText('Amount is required')).toBeInTheDocument()
  })
})
