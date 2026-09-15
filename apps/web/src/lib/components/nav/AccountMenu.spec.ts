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

  it('picks a readable foreground for the user colour', () => {
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    const trigger = screen.getByRole('button', { name: 'Account menu for Brian' })
    // #4f46e5 is dark enough that white is the higher-contrast choice.
    expect(trigger.style.color).toBe('rgb(255, 255, 255)')
  })

  it('uses a theme-aware muted fill and foreground when the colour is missing', () => {
    render(AccountMenu, { user: { ...brian, displayColor: null }, onLogout: vi.fn() })

    const trigger = screen.getByRole('button', { name: 'Account menu for Brian' })
    expect(trigger.getAttribute('style')).toContain('var(--muted-ink)')
    // --muted-ink is dark in light mode, so white initials.
    expect(trigger.style.color).toBe('rgb(255, 255, 255)')
  })

  it('uses black initials on the muted fill in dark mode', () => {
    themeState.current = 'dark'
    render(AccountMenu, { user: { ...brian, displayColor: null }, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'Account menu for Brian' }).style.color).toBe(
      'rgb(0, 0, 0)'
    )
  })

  it('falls back to the muted fill for an unparseable colour', () => {
    render(AccountMenu, { user: { ...brian, displayColor: 'yellow' }, onLogout: vi.fn() })

    // Never paint the raw string with white text on top.
    expect(
      screen.getByRole('button', { name: 'Account menu for Brian' }).getAttribute('style')
    ).toContain('var(--muted-ink)')
  })

  it('falls back to the email when the user has no full name', () => {
    render(AccountMenu, { user: { ...brian, fullName: null }, onLogout: vi.fn() })

    expect(
      screen.getByRole('button', { name: 'Account menu for brian@example.com' })
    ).toBeInTheDocument()
  })

  it('links to Categories, Tasks and Settings once opened', async () => {
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Categories').closest('a')).toHaveAttribute('href', '/categories')
    expect(screen.getByText('Tasks').closest('a')).toHaveAttribute('href', '/tasks')
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
  })

  it('highlights the current route inside the menu', async () => {
    setPageUrl('http://localhost/tasks')
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Tasks')).toHaveClass('text-violet')
    expect(screen.getByText('Categories')).toHaveClass('text-ink')
  })

  it('is not active on a route that merely shares a prefix', () => {
    // /tasks-2026 must not count as /tasks - a raw `startsWith` would get
    // this wrong (see route-active.spec.ts for the unit-level case).
    setPageUrl('http://localhost/tasks-2026')
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'Account menu for Brian' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('marks the active trigger and menu item with aria-current', async () => {
    setPageUrl('http://localhost/tasks')
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    expect(screen.getByRole('button', { name: 'Account menu for Brian' })).toHaveAttribute(
      'aria-current',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Tasks').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Categories').closest('a')).not.toHaveAttribute('aria-current')
  })

  it("keeps the vendored item's own interaction styling alongside the active-route colour", async () => {
    // Regression check for the `props.class` merge fix (see DESIGN.md's
    // decisions log) - `focus:bg-accent` etc. must survive alongside our
    // own colour, not be overwritten by it.
    const user = userEvent.setup()
    render(AccountMenu, { user: brian, onLogout: vi.fn() })

    await user.click(screen.getByRole('button', { name: 'Account menu for Brian' }))

    expect(screen.getByText('Categories')).toHaveClass('focus:bg-accent')
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

  // A `createRawSnippet` fixture can't wire up bits-ui's real onclick
  // handler onto its static markup, so these can only verify the *shape*
  // of what's passed through (a `{ props }` wrapper matching bits-ui's own
  // `child`-snippet contract, plus `active`) - not that clicking it opens
  // the menu. That's covered end-to-end by MobileTabBar.spec.ts, whose
  // custom triggers are real Svelte snippets that do spread `{...props}`
  // and are clicked to confirm the menu opens.
  it('is active when the current route is Categories/Tasks/Settings', () => {
    setPageUrl('http://localhost/settings')
    const triggerSnippet = createRawSnippet<[{ props: Record<string, unknown> }, boolean]>(
      (propsArg, active) => ({
        render: () => {
          const { props } = propsArg()
          return `<button data-has-props="${'aria-haspopup' in props}" ${active() ? 'data-active' : ''}>Custom trigger</button>`
        },
      })
    )
    render(AccountMenu, { user: brian, onLogout: vi.fn(), trigger: triggerSnippet })

    const trigger = screen.getByRole('button', { name: 'Custom trigger' })
    expect(trigger).toHaveAttribute('data-active')
    expect(trigger).toHaveAttribute('data-has-props', 'true')
  })

  it('is not active on an unrelated route', () => {
    setPageUrl('http://localhost/monthly')
    const triggerSnippet = createRawSnippet<[{ props: Record<string, unknown> }, boolean]>(
      (_props, active) => ({
        render: () => `<button ${active() ? 'data-active' : ''}>Custom trigger</button>`,
      })
    )
    render(AccountMenu, { user: brian, onLogout: vi.fn(), trigger: triggerSnippet })

    expect(screen.getByRole('button', { name: 'Custom trigger' })).not.toHaveAttribute(
      'data-active'
    )
  })
})
