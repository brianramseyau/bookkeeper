import { createRawSnippet } from 'svelte'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto, replaceState } from '$app/navigation'
import { page } from '$app/state'
import { api } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import { themeState } from '$lib/stores/theme.svelte'
import { monthState } from '$lib/stores/month.svelte'
import Layout from './+layout.svelte'

// `afterNavigate` is mocked to invoke its callback immediately with the
// current `page.url`, standing in for the real router being ready after the
// initial navigation - the layout reads the month from `to.url` and gates its
// URL write-back on that signal. `navType` lets a test simulate a back/forward
// (`popstate`) instead of the default forward navigation.
const { navState } = vi.hoisted(() => ({ navState: { type: 'link' as string } }))
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  replaceState: vi.fn(),
  afterNavigate: (cb: (nav: { type: string; to: { url: URL } }) => void) =>
    cb({ type: navState.type, to: { url: page.url } }),
}))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))
vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  setUnauthorizedListener: vi.fn(),
}))

// SvelteKit's real `Page.url` type brands `pathname` with a union of the
// app's known routes - the mock above is a plain URL, so route it through a
// cast here rather than fighting that type at every call site below.
function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

const brian = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: '#4f46e5',
  initials: 'B',
}

const childrenSnippet = createRawSnippet(() => ({
  render: () => '<div data-testid="child-content">Page content</div>',
}))

describe('+layout.svelte', () => {
  beforeEach(() => {
    // Fixes "now" so `monthState.isCurrentMonth` (which reads the clock) is
    // deterministic - matches the store's March 2026 default below.
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    navState.type = 'link'
    authState.user = null
    authState.loading = true
    themeState.current = 'light'
    document.documentElement.classList.remove('dark')
    monthState.year = 2026
    monthState.month = 3
    setPageUrl('http://localhost/')
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(goto).mockReset()
    vi.mocked(replaceState).mockReset()
  })

  it('shows a loading indicator while the session is being checked', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}))

    render(Layout, { children: childrenSnippet })

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated and not already there', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('401'))
    setPageUrl('http://localhost/monthly')

    render(Layout, { children: childrenSnippet })

    await waitFor(() => expect(goto).toHaveBeenCalledWith('/login'))
  })

  it('does not redirect when unauthenticated and already on /login', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('401'))
    setPageUrl('http://localhost/login')

    render(Layout, { children: childrenSnippet })

    expect(await screen.findByTestId('child-content')).toBeInTheDocument()
    expect(goto).not.toHaveBeenCalled()
  })

  it('redirects away from /login when already authenticated', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    setPageUrl('http://localhost/login')

    render(Layout, { children: childrenSnippet })

    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'))
  })

  it('renders the nav, user display, and page content when authenticated', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    setPageUrl('http://localhost/monthly')

    render(Layout, { children: childrenSnippet })

    expect(await screen.findByText('Bookkeeper')).toBeInTheDocument()
    expect(screen.getAllByText('Monthly').length).toBeGreaterThan(0)
    expect(screen.getAllByTitle('Brian').length).toBeGreaterThan(0)
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('falls back to the email when the user has no full name', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...brian, fullName: null })
    setPageUrl('http://localhost/')

    render(Layout, { children: childrenSnippet })

    expect(await screen.findAllByTitle('brian@example.com')).not.toHaveLength(0)
  })

  it('seeds the shared month from explicit URL params on a month route', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    setPageUrl('http://localhost/monthly?year=2025&month=11')

    render(Layout, { children: childrenSnippet })

    await waitFor(() => {
      expect(monthState.year).toBe(2025)
      expect(monthState.month).toBe(11)
    })
  })

  it('leaves the shared month untouched on a non-month route', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    monthState.year = 2026
    monthState.month = 3
    setPageUrl('http://localhost/income?year=2025&month=11')

    render(Layout, { children: childrenSnippet })
    await screen.findByText('Bookkeeper')

    expect(monthState.year).toBe(2026)
    expect(monthState.month).toBe(3)
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('writes the shared month into the URL on a bare month route', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    monthState.year = 2024
    monthState.month = 6
    setPageUrl('http://localhost/monthly')

    render(Layout, { children: childrenSnippet })

    await waitFor(() =>
      expect(replaceState).toHaveBeenLastCalledWith('/monthly?year=2024&month=6', {})
    )
  })

  it('keeps the session month when navigating to a bare month route', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    monthState.year = 2024
    monthState.month = 6
    setPageUrl('http://localhost/')

    const first = render(Layout, { children: childrenSnippet })
    await screen.findByText('Bookkeeper')
    first.unmount()

    // A plain nav link to Monthly carries no params; the session's month
    // should survive rather than resetting.
    setPageUrl('http://localhost/monthly')
    render(Layout, { children: childrenSnippet })

    await waitFor(() => expect(monthState.year).toBe(2024))
    expect(monthState.month).toBe(6)
    expect(replaceState).toHaveBeenLastCalledWith('/monthly?year=2024&month=6', {})
  })

  it('strips params when the shared month is the current month', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    // beforeEach fixes "now" at March 2026 and the store at 2026-03.
    setPageUrl('http://localhost/monthly?year=2026&month=3')

    render(Layout, { children: childrenSnippet })
    await screen.findByText('Bookkeeper')

    await waitFor(() => expect(replaceState).toHaveBeenLastCalledWith('/monthly', {}))
  })

  it('resets to the current month when back/forward lands on a bare URL', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    monthState.year = 2024
    monthState.month = 6
    navState.type = 'popstate'
    setPageUrl('http://localhost/monthly')

    render(Layout, { children: childrenSnippet })
    await screen.findByText('Bookkeeper')

    await waitFor(() => expect(monthState.year).toBe(2026))
    expect(monthState.month).toBe(3)
  })

  it('logs out and redirects to /login', async () => {
    // Log out now lives inside the desktop AccountMenu's dropdown (see
    // AccountMenu.spec.ts for its own behaviour in isolation) - this test
    // is only about the wiring +layout.svelte owns: handleLogout actually
    // calls the logout API and redirects. Two AccountMenu instances render
    // simultaneously (desktop nav + MobileTabBar's "More" tab, both always
    // in the DOM under jsdom regardless of viewport), so target the
    // desktop one by its distinct accessible name.
    vi.mocked(api.get).mockResolvedValue(brian)
    vi.mocked(api.post).mockResolvedValue(undefined)
    setPageUrl('http://localhost/')

    render(Layout, { children: childrenSnippet })

    await fireEvent.click(await screen.findByRole('button', { name: 'Account menu for Brian' }))
    await fireEvent.click(await screen.findByText('Log out'))

    expect(api.post).toHaveBeenCalledWith('/logout')
    expect(authState.user).toBeNull()
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/login'))
  })
})
