import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { page } from '$app/state'
import MobileTabBar from './MobileTabBar.svelte'

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))

// See ActionMenu.spec.ts: bits-ui's floating (DropdownMenu) content stays
// `visibility: hidden` under jsdom, which breaks `getByRole(role, { name })`'s
// accessible-name computation - `getByText` is used instead for content
// inside an opened menu, since it matches raw text content rather than the
// accessibility tree and isn't affected by that.

function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

const brian = {
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: '#4f46e5',
  initials: 'B',
}

describe('MobileTabBar', () => {
  it('renders Home, Monthly, Income, Outgoings and More', () => {
    setPageUrl('http://localhost/')
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Monthly' })).toHaveAttribute('href', '/monthly')
    expect(screen.getByRole('link', { name: 'Income' })).toHaveAttribute('href', '/income')
    expect(screen.getByRole('button', { name: 'Outgoings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('marks Home active only on the exact root route', () => {
    setPageUrl('http://localhost/monthly')
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('text-muted-ink')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Monthly' })).toHaveClass('text-violet')
    expect(screen.getByRole('link', { name: 'Monthly' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the Outgoings menu and links to a sub-page', async () => {
    setPageUrl('http://localhost/')
    const user = userEvent.setup()
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills').closest('a')).toHaveAttribute('href', '/bills')
  })

  it('marks the Outgoings tab active on a bill/subscription/expense/utility route', () => {
    setPageUrl('http://localhost/subscriptions')
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'Outgoings' })).toHaveClass('text-violet')
    expect(screen.getByRole('button', { name: 'Outgoings' })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  it('does not mark the Outgoings tab active on a route that merely shares a prefix', () => {
    setPageUrl('http://localhost/bills-archive')
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'Outgoings' })).not.toHaveClass('text-violet')
  })

  it('opens the More menu and links to Settings', async () => {
    setPageUrl('http://localhost/')
    const user = userEvent.setup()
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'More' }))

    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
  })

  it('marks the More tab active on the Categories/Tasks/Settings routes', () => {
    setPageUrl('http://localhost/categories')
    render(MobileTabBar, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'More' })).toHaveClass('text-violet')
  })
})
