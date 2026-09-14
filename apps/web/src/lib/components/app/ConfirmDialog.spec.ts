import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog.svelte'

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(ConfirmDialog, {
      open: false,
      onOpenChange: vi.fn(),
      title: 'Delete "Groceries"?',
      onConfirm: vi.fn(),
    })

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('shows the title, description and default labels when open', () => {
    render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Delete "Groceries"?',
      description: 'This cannot be undone.',
      onConfirm: vi.fn(),
    })

    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Delete "Groceries"?')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders custom confirm/cancel labels', () => {
    render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Archive "Groceries"?',
      confirmLabel: 'Archive',
      cancelLabel: 'Keep it',
      onConfirm: vi.fn(),
    })

    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked, without closing itself', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(ConfirmDialog, { open: true, onOpenChange, title: 'Delete it?', onConfirm })

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('calls onOpenChange(false) when cancelled', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(ConfirmDialog, { open: true, onOpenChange, title: 'Delete it?', onConfirm: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('uses destructive styling by default', () => {
    render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Delete it?',
      onConfirm: vi.fn(),
    })

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('text-destructive')
  })

  it('uses default (non-destructive) styling when destructive is false', () => {
    render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Send it?',
      confirmLabel: 'Send',
      destructive: false,
      onConfirm: vi.fn(),
    })

    expect(screen.getByRole('button', { name: 'Send' })).not.toHaveClass('text-destructive')
  })
})
