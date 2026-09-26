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

  it('guards against a double-click firing onConfirm twice while the dialog stays open', async () => {
    // onConfirm here does *not* call onOpenChange(false), simulating a
    // caller doing async work and keeping the dialog open until it finishes
    // (see the onConfirm prop doc) - the scenario Kilo Code Review flagged
    // where AlertDialogAction doesn't close itself.
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(ConfirmDialog, { open: true, onOpenChange: vi.fn(), title: 'Delete it?', onConfirm })

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(confirmButton)
    expect(confirmButton).toBeDisabled()
    await user.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('keeps focus inside the dialog once the confirm button disables itself', async () => {
    const user = userEvent.setup()
    render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Delete it?',
      onConfirm: vi.fn(),
    })

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    confirmButton.focus()
    await user.click(confirmButton)

    expect(confirmButton).toBeDisabled()
    expect(document.activeElement).not.toBe(document.body)
    expect(screen.getByRole('alertdialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('still blocks a double-click when pending is explicitly false at rest, not just when omitted', async () => {
    // The failure mode Kilo Code Review's follow-up flagged: a caller
    // passing a reactive `isSaving`/`isBusy` flag that starts `false` (not
    // omitted) must not lose the built-in guard just for having supplied
    // `pending` at all - only an explicit `true` should ever disable it.
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Delete it?',
      onConfirm,
      pending: false,
    })

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(confirmButton)
    expect(confirmButton).toBeDisabled()
    await user.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('lets a caller control the guard via `pending`, allowing retry after a failed attempt', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(ConfirmDialog, {
      open: true,
      onOpenChange: vi.fn(),
      title: 'Delete it?',
      onConfirm,
      pending: true,
    })

    // Already pending (e.g. a previous attempt failed and the caller hasn't
    // cleared it yet) - clicking must not re-invoke onConfirm.
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).not.toHaveBeenCalled()

    // Caller clears `pending` once the failed attempt has been handled -
    // unlike the internally-managed default, this does *not* require
    // closing and reopening the dialog to allow a retry.
    await rerender({
      open: true,
      onOpenChange: vi.fn(),
      title: 'Delete it?',
      onConfirm,
      pending: false,
    })
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
