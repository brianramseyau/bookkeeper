import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { StandardMonthLine } from '$lib/api/standard-month'
import OutgoingLineEditSheet, { type OutgoingLineEditTarget } from './OutgoingLineEditSheet.svelte'

function makeLine(overrides: Partial<StandardMonthLine> = {}): StandardMonthLine {
  return {
    key: 'utility-1',
    label: 'Electricity',
    projected: 100,
    actual: 110,
    dueDay: null,
    dueDate: null,
    dueDateEstimated: false,
    paid: false,
    estimated: false,
    editable: true,
    receivedOn: '2026-03-14',
    ...overrides,
  }
}

function baseProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    target: { mode: 'utility', line: makeLine() } as OutgoingLineEditTarget,
    submitting: false,
    onSave: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
}

describe('OutgoingLineEditSheet', () => {
  it('renders nothing when closed', () => {
    render(OutgoingLineEditSheet, { props: baseProps({ open: false, target: null }) })

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('pre-fills amount and received date for a utility line', () => {
    render(OutgoingLineEditSheet, { props: baseProps() })

    expect(screen.getByLabelText('Amount')).toHaveValue(110)
    expect(screen.getByLabelText('Received on')).toHaveValue('2026-03-14')
  })

  it('calls onSave with the edited amount and received date', async () => {
    const onSave = vi.fn()
    render(OutgoingLineEditSheet, { props: baseProps({ onSave }) })

    // fireEvent rather than userEvent - a real pointerdown on Drawer content
    // hits vaul-svelte's drag-to-dismiss handler, which needs
    // setPointerCapture (unimplemented in jsdom).
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '120' } })
    await fireEvent.input(screen.getByLabelText('Received on'), {
      target: { value: '2026-03-21' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith({ amount: 120, receivedOn: '2026-03-21' })
  })

  it('shows only an amount for a subscription line, with no received date', () => {
    render(OutgoingLineEditSheet, {
      props: baseProps({
        target: { mode: 'subscription', line: makeLine({ key: 'subscription-9' }) },
      }),
    })

    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
    expect(screen.queryByLabelText('Received on')).toBeNull()
  })

  it('titles an expense-add sheet "Add <line>" with an "Add entry" button', () => {
    render(OutgoingLineEditSheet, {
      props: baseProps({
        target: {
          mode: 'expense-add',
          line: makeLine({ key: 'expense-1', label: 'Groceries' }),
          expenseId: 1,
        },
      }),
    })

    expect(screen.getByRole('heading', { name: 'Add Groceries', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeInTheDocument()
  })

  it('offers a delete action for an expense-edit line', async () => {
    const onRemove = vi.fn()
    render(OutgoingLineEditSheet, {
      props: baseProps({
        target: {
          mode: 'expense-edit',
          line: makeLine({ key: 'expense-1', label: 'Groceries' }),
          expenseId: 1,
          actualId: 5,
        },
        onRemove,
      }),
    })

    await fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('points at the expense detail page when there are multiple actuals', () => {
    render(OutgoingLineEditSheet, {
      props: baseProps({
        target: {
          mode: 'expense-multiple',
          line: makeLine({ key: 'expense-1', label: 'Groceries' }),
          expenseId: 1,
        },
      }),
    })

    expect(screen.queryByLabelText('Amount')).toBeNull()
    const link = screen.getByRole('link', { name: 'Open Groceries' })
    expect(link).toHaveAttribute('href', '/expenses/1')
  })

  it('shows the error message when given one', () => {
    render(OutgoingLineEditSheet, { props: baseProps({ error: 'Enter an amount' }) })

    expect(screen.getByText('Enter an amount')).toBeInTheDocument()
  })
})
