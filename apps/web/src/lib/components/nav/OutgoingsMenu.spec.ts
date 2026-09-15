import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { page } from '$app/state'
import OutgoingsMenu from './OutgoingsMenu.svelte'

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))

// See ActionMenu.spec.ts: bits-ui's floating (DropdownMenu) content stays
// `visibility: hidden` under jsdom, which breaks `getByRole(role, { name })`'s
// accessible-name computation - `getByText` is used instead for content
// inside an opened menu, since it matches raw text content rather than the
// accessibility tree and isn't affected by that.

function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

describe('OutgoingsMenu', () => {
  it('renders a Bills/Subscriptions/Expenses/Utilities link once opened', async () => {
    setPageUrl('http://localhost/monthly')
    const user = userEvent.setup()
    render(OutgoingsMenu)

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills').closest('a')).toHaveAttribute('href', '/bills')
    expect(screen.getByText('Subscriptions').closest('a')).toHaveAttribute(
      'href',
      '/subscriptions'
    )
    expect(screen.getByText('Expenses').closest('a')).toHaveAttribute('href', '/expenses')
    expect(screen.getByText('Utilities').closest('a')).toHaveAttribute('href', '/utilities')
  })

  it('is not active on a route outside the group', () => {
    setPageUrl('http://localhost/monthly')
    render(OutgoingsMenu)

    expect(screen.getByRole('button', { name: 'Outgoings' })).not.toHaveClass('text-violet')
  })

  it.each(['/bills', '/subscriptions', '/expenses', '/utilities'])(
    'is active on %s',
    (path) => {
      setPageUrl(`http://localhost${path}`)
      render(OutgoingsMenu)

      expect(screen.getByRole('button', { name: 'Outgoings' })).toHaveClass('text-violet')
    }
  )

  it('supports a custom trigger, receiving the active flag', async () => {
    setPageUrl('http://localhost/bills')
    const triggerSnippet = createRawSnippet<[Record<string, unknown>, boolean]>(
      (_props, active) => ({
        render: () => `<button ${active() ? 'data-active' : ''}>Custom trigger</button>`,
      })
    )
    render(OutgoingsMenu, { trigger: triggerSnippet })

    const trigger = screen.getByRole('button', { name: 'Custom trigger' })
    expect(trigger).toHaveAttribute('data-active')
  })

  it('highlights the current route inside the menu', async () => {
    setPageUrl('http://localhost/bills')
    const user = userEvent.setup()
    render(OutgoingsMenu)

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills')).toHaveClass('text-violet')
    expect(screen.getByText('Subscriptions')).toHaveClass('text-ink')
  })
})
