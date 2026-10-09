import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditState } from '$lib/edit-state.svelte'
import CarryoverCard from './CarryoverCard.svelte'

describe('CarryoverCard', () => {
  it('shows the carried-over amount and an edit button when not editing', () => {
    render(CarryoverCard, {
      carryover: 500,
      editState: new EditState<true, { amount: number }>(),
      onStartEdit: vi.fn(),
      onSave: vi.fn(),
    })

    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Edit carried over balance' })[0]
    ).toBeInTheDocument()
  })

  it('calls onStartEdit when the edit button is clicked', async () => {
    const onStartEdit = vi.fn()
    const user = userEvent.setup()
    render(CarryoverCard, {
      carryover: 500,
      editState: new EditState<true, { amount: number }>(),
      onStartEdit,
      onSave: vi.fn(),
    })

    await user.click(screen.getAllByRole('button', { name: 'Edit carried over balance' })[0]!)
    expect(onStartEdit).toHaveBeenCalledOnce()
  })

  it('disables the edit button while the month is stale', () => {
    render(CarryoverCard, {
      carryover: 500,
      editState: new EditState<true, { amount: number }>(),
      disabled: true,
      onStartEdit: vi.fn(),
      onSave: vi.fn(),
    })

    expect(screen.getAllByRole('button', { name: 'Edit carried over balance' })[0]).toBeDisabled()
  })

  it('shows an amount input and calls onSave when editing', async () => {
    const onSave = vi.fn()
    const editState = new EditState<true, { amount: number }>()
    editState.start(true, { amount: 500 })
    const user = userEvent.setup()
    render(CarryoverCard, { carryover: 500, editState, onStartEdit: vi.fn(), onSave })

    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Save carried over balance' })[0]!)
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('cancels editing via the EditState instance directly', async () => {
    const editState = new EditState<true, { amount: number }>()
    editState.start(true, { amount: 500 })
    const user = userEvent.setup()
    render(CarryoverCard, { carryover: 500, editState, onStartEdit: vi.fn(), onSave: vi.fn() })

    await user.click(
      screen.getAllByRole('button', { name: 'Cancel editing carried over balance' })[0]!
    )
    expect(editState.isEditing).toBe(false)
  })
})
