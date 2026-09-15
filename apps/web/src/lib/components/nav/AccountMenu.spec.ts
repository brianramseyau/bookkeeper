import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from '$app/state'
import { themeState } from '$lib/stores/theme.svelte'
import AccountMenu from './AccountMenu.svelte'

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

describe('AccountMenu', () => {
  beforeEach(() => {
    setPageUrl('http://localhost/')
    themeState.current = 'light'
  })

  it('shows the user initials on their displayColor as the default trigger', () => {
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    const trigger = screen.getByRole('button', { name: 'Account menu for Brian' })
    expect(trigger).toHaveTextContent('B')
    // jsdom normalises the inline style's hex colour to rgb() - compare
    // the computed style rather than the raw attribute string.
    expect(trigger.style.backgroundColor).toBe('rgb(79, 70, 229)')
  })

  it('falls back to the email when the user has no full name', () => {
    render(AccountMenu, { user: { ...brian, fullName: null }, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'Account menu for brian@example.com' })).toBeInTheDocument()
  })

  it('links to Categories, Tasks and Settings once opened', async () => {
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Categories').closest('a')).toHaveAttribute(
      'href',
      '/categories'
    )
    expect(screen.getByText('Tasks').closest('a')).toHaveAttribute('href', '/tasks')
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute(
      'href',
      '/settings'
    )
  })

  it('highlights the current route inside the menu', async () => {
    setPageUrl('http://localhost/tasks')
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Tasks')).toHaveClass('text-violet')
    expect(screen.getByText('Categories')).toHaveClass('text-ink')
  })

  it('toggles the theme from the menu, without closing on it alone mattering', async () => {
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))
    await user.click(screen.getByText('Dark mode'))

    expect(themeState.current).toBe('dark')
  })

  it('shows "Light mode" once already in dark mode', async () => {
    themeState.current = 'dark'
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Light mode')).toBeInTheDocument()
  })

  it('calls onLogout when Log out is selected', async () => {
    const onLogout = vi.fn()
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))
    await user.click(screen.getByText('Log out'))

    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('is active when the current route is Categories/Tasks/Settings', () => {
    setPageUrl('http://localhost/settings')
    const triggerSnippet = createRawSnippet<[Record<string, unknown>, boolean]>((_props, active) => ({
      render: () => `<button ${active() ? 'data-active' : ''}>Custom trigger</button>`,
    }))
    render(AccountMenu, { user: brian, onLogout: vi.fn(), trigger: triggerSnippet })

    expect(screen.getByRole('button', { name: 'Custom trigger' })).toHaveAttribute('data-active')
  })

  it('is not active on an unrelated route', () => {
    setPageUrl('http://localhost/monthly')
    const triggerSnippet = createRawSnippet<[Record<string, unknown>, boolean]>((_props, active) => ({
      render: () => `<button ${active() ? 'data-active' : ''}>Custom trigger</button>`,
    }))
    render(AccountMenu, { user: brian, onLogout: vi.fn(), trigger: triggerSnippet })

    expect(screen.getByRole('button', { name: 'Custom trigger' })).not.toHaveAttribute(
      'data-active'
    )
  })
})
