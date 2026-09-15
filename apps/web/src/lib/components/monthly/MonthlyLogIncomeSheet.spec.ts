import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeSource } from '$lib/api/income'
import type { UserSummary } from '$lib/api/users'
import MonthlyLogIncomeSheet from './MonthlyLogIncomeSheet.svelte'

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}

const brianSalary: IncomeSource = {
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

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    sources: [brianSalary],
    users: [brian],
    submitting: false,
    onSubmit: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('MonthlyLogIncomeSheet', () => {
  it('renders nothing when closed', () => {
    render(MonthlyLogIncomeSheet, { props: baseProps({ open: false }) })

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('renders the form with a Person/Source picker and a footer submit', () => {
    render(MonthlyLogIncomeSheet, { props: baseProps() })

    expect(screen.getByRole('heading', { name: 'Log income', hidden: true })).toBeInTheDocument()
    expect(screen.getByLabelText('Person')).toBeInTheDocument()
    expect(screen.getByLabelText('Source')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
  })

  it('submits the values and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    const onOpenChange = vi.fn()
    render(MonthlyLogIncomeSheet, { props: baseProps({ onSubmit, onOpenChange }) })

    await fireEvent.change(screen.getByLabelText('Person'), { target: { value: '1' } })
    await fireEvent.change(screen.getByLabelText('Source'), { target: { value: '1' } })
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '100' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Log income' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ incomeSourceId: 1, userId: null, amount: 100 })
      )
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the sheet open and shows the error when logging fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    const onOpenChange = vi.fn()
    render(MonthlyLogIncomeSheet, {
      props: baseProps({ onSubmit, onOpenChange, error: 'Could not log income' }),
    })

    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '100' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Log income' }))

    expect(screen.getByText('Could not log income')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes from the Cancel button', async () => {
    const onOpenChange = vi.fn()
    render(MonthlyLogIncomeSheet, { props: baseProps({ onOpenChange }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
