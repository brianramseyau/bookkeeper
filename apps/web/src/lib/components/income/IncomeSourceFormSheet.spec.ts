import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeSource } from '$lib/api/income'
import IncomeSourceFormSheet from './IncomeSourceFormSheet.svelte'

const brianSalary: IncomeSource = {
  id: 1,
  userId: 1,
  name: 'Brian Income',
  expectedAmount: 5000,
  frequency: 'monthly',
  payDayOfMonth: 14,
  weekendRollback: true,
  anchorDate: null,
  taxWithheld: true,
  isActive: true,
  notes: null,
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    source: null as IncomeSource | null,
    submitting: false,
    onSubmit: vi.fn(),
    ...overrides,
  }
}

describe('IncomeSourceFormSheet', () => {
  it('renders nothing when closed', () => {
    render(IncomeSourceFormSheet, { props: baseProps({ open: false }) })

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('starts blank in add mode', () => {
    render(IncomeSourceFormSheet, { props: baseProps() })

    expect(
      screen.getByRole('heading', { name: 'Add income source', hidden: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add income source' })).toBeInTheDocument()
  })

  it('prefills an existing source in edit mode', () => {
    render(IncomeSourceFormSheet, { props: baseProps({ source: brianSalary }) })

    expect(
      screen.getByRole('heading', { name: 'Edit Brian Income', hidden: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Brian Income')
    expect(screen.getByLabelText('Expected per pay')).toHaveValue(5000)
    expect(screen.getByLabelText('Pay day of month')).toHaveValue(14)
    expect(screen.getByLabelText(/Roll to the preceding Friday/)).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('swaps the pay-day fields for an anchor date on fortnightly', async () => {
    render(IncomeSourceFormSheet, { props: baseProps({ source: brianSalary }) })

    await fireEvent.change(screen.getByLabelText('Frequency'), {
      target: { value: 'fortnightly' },
    })

    expect(screen.queryByLabelText('Pay day of month')).toBeNull()
    expect(screen.getByLabelText('A confirmed real pay date')).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(IncomeSourceFormSheet, { props: baseProps() })

    await fireEvent.click(screen.getByRole('button', { name: 'Add income source' }))
    expect(await screen.findByText('Enter a name')).toBeInTheDocument()

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Bonus' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Add income source' }))
    expect(await screen.findByText('Enter an expected amount')).toBeInTheDocument()

    await fireEvent.input(screen.getByLabelText('Expected per pay'), { target: { value: '100' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Add income source' }))
    expect(await screen.findByText('Enter a pay day of the month')).toBeInTheDocument()
  })

  it('requires an anchor date for a fortnightly source', async () => {
    render(IncomeSourceFormSheet, { props: baseProps() })

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Side gig' } })
    await fireEvent.input(screen.getByLabelText('Expected per pay'), { target: { value: '100' } })
    await fireEvent.change(screen.getByLabelText('Frequency'), {
      target: { value: 'fortnightly' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Add income source' }))

    expect(await screen.findByText('Pick an anchor pay date')).toBeInTheDocument()
  })

  it('submits monthly values with a null anchor date', async () => {
    const onSubmit = vi.fn()
    render(IncomeSourceFormSheet, { props: baseProps({ onSubmit }) })

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Bonus' } })
    await fireEvent.input(screen.getByLabelText('Expected per pay'), { target: { value: '250' } })
    await fireEvent.input(screen.getByLabelText('Pay day of month'), { target: { value: '1' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Add income source' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Bonus',
      expectedAmount: 250,
      frequency: 'monthly',
      payDayOfMonth: 1,
      weekendRollback: false,
      anchorDate: null,
      taxWithheld: true,
    })
  })

  it('submits fortnightly values with a null pay day', async () => {
    const onSubmit = vi.fn()
    render(IncomeSourceFormSheet, { props: baseProps({ onSubmit }) })

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Side gig' } })
    await fireEvent.input(screen.getByLabelText('Expected per pay'), { target: { value: '100' } })
    await fireEvent.change(screen.getByLabelText('Frequency'), {
      target: { value: 'fortnightly' },
    })
    await fireEvent.input(screen.getByLabelText('A confirmed real pay date'), {
      target: { value: '2026-07-22' },
    })
    await fireEvent.click(screen.getByRole('button', { name: 'Add income source' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: 'fortnightly',
        payDayOfMonth: null,
        anchorDate: '2026-07-22',
      })
    )
  })

  it('closes from the Cancel button', async () => {
    const onOpenChange = vi.fn()
    render(IncomeSourceFormSheet, { props: baseProps({ onOpenChange }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the error message when given one', () => {
    render(IncomeSourceFormSheet, { props: baseProps({ error: 'Name already exists' }) })

    expect(screen.getByText('Name already exists')).toBeInTheDocument()
  })
})
