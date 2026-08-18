import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { mdiArchive, mdiPencil } from '@mdi/js'
import ActionMenu from './ActionMenu.svelte'

describe('ActionMenu', () => {
  it('opens the menu and fires the clicked action, then closes', async () => {
    const onEdit = vi.fn()
    const onArchive = vi.fn()
    const user = userEvent.setup()
    render(ActionMenu, {
      label: 'Actions for Groceries',
      actions: [
        { label: 'Edit', path: mdiPencil, onclick: onEdit },
        { label: 'Archive', path: mdiArchive, variant: 'muted', onclick: onArchive },
      ],
    })

    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    expect(onArchive).toHaveBeenCalledOnce()
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes the menu without firing an action when clicking outside', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(ActionMenu, {
      label: 'Actions for Groceries',
      actions: [{ label: 'Edit', path: mdiPencil, onclick: onEdit }],
    })

    await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.queryByRole('menu')).toBeNull()
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('does not fire a disabled action', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(ActionMenu, {
      label: 'Actions for Groceries',
      actions: [
        { label: 'Delete', path: mdiArchive, variant: 'danger', onclick: onDelete, disabled: true },
      ],
    })

    await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('renders a custom trigger instead of the default ⋮ button', () => {
    const trigger = createRawSnippet(() => ({
      render: () => '<button type="button">Custom add</button>',
    }))
    const { getByRole, queryByRole } = render(ActionMenu, {
      label: 'Add income',
      actions: [{ label: 'Salary', path: mdiPencil, onclick: vi.fn() }],
      trigger,
    })

    expect(getByRole('button', { name: 'Custom add' })).toBeInTheDocument()
    expect(queryByRole('button', { name: 'Add income' })).toBeNull()
  })
})
