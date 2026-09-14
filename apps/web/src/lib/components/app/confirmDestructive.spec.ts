import { screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { confirmDestructive } from './confirmDestructive.svelte'

// confirmDestructive mounts straight to document.body (there's no host
// component to render it into, unlike every other spec in this app) -
// clean that up directly rather than via @testing-library/svelte's render.
afterEach(() => {
  document.body.innerHTML = ''
})

describe('confirmDestructive', () => {
  it('resolves true when the destructive action is confirmed', async () => {
    const user = userEvent.setup()
    const result = confirmDestructive({ title: 'Delete "Groceries"?' })

    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await result).toBe(true)
  })

  it('resolves false when cancelled', async () => {
    const user = userEvent.setup()
    const result = confirmDestructive({ title: 'Delete "Groceries"?' })

    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await result).toBe(false)
  })

  it('passes through a description and custom labels', async () => {
    const user = userEvent.setup()
    const result = confirmDestructive({
      title: 'Archive "Groceries"?',
      description: 'You can unarchive it later.',
      confirmLabel: 'Archive',
      cancelLabel: 'Keep it',
    })

    await screen.findByText('Archive "Groceries"?')
    expect(screen.getByText('You can unarchive it later.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(await result).toBe(false)
  })

  it('removes the dialog from the DOM once settled', async () => {
    const user = userEvent.setup()
    const result = confirmDestructive({ title: 'Delete "Groceries"?' })

    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await result

    await waitFor(() => expect(screen.queryByRole('alertdialog', { hidden: true })).toBeNull())
  })
})
