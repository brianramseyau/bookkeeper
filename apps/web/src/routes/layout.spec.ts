import { createRawSnippet } from 'svelte'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { api } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import { themeState } from '$lib/stores/theme.svelte'
import Layout from './+layout.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))
vi.mock('$lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

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
    authState.user = null
    authState.loading = true
    themeState.current = 'light'
    document.documentElement.classList.remove('dark')
    setPageUrl('http://localhost/')
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(goto).mockReset()
  })

  it('shows a loading indicator while the session is being checked', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}))

    render(Layout, { children: childrenSnippet })

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated and not already there', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('401'))
    setPageUrl('http://localhost/month')

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
    setPageUrl('http://localhost/month')

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

  it('logs out and redirects to /login', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    vi.mocked(api.post).mockResolvedValue(undefined)
    setPageUrl('http://localhost/')

    render(Layout, { children: childrenSnippet })

    await fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(api.post).toHaveBeenCalledWith('/logout')
    expect(authState.user).toBeNull()
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/login'))
  })

  it('toggles dark mode', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    setPageUrl('http://localhost/')

    render(Layout, { children: childrenSnippet })

    await fireEvent.click(await screen.findByRole('button', { name: 'Toggle dark mode' }))

    expect(themeState.current).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('opens and closes the mobile menu', async () => {
    vi.mocked(api.get).mockResolvedValue(brian)
    setPageUrl('http://localhost/')

    render(Layout, { children: childrenSnippet })
    const toggle = await screen.findByRole('button', { name: 'Toggle menu' })

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
