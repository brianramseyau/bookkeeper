import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, setUnauthorizedListener } from '$lib/api'
import { authState, loadCurrentUser, login, logout } from './auth.svelte'

vi.mock('$lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  setUnauthorizedListener: vi.fn(),
}))

const currentUser = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: '#000000',
  initials: 'B',
}

// Captured at module load, before any test's `afterEach` can clear the mock's call history.
const handleUnauthorized = vi.mocked(setUnauthorizedListener).mock.calls[0]![0]!

describe('auth store', () => {
  beforeEach(() => {
    authState.user = null
    authState.loading = true
    authState.sessionExpired = false
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('loads the current user on success', async () => {
    vi.mocked(api.get).mockResolvedValue(currentUser)

    await loadCurrentUser()

    expect(authState.user).toEqual(currentUser)
    expect(authState.loading).toBe(false)
  })

  it('clears the user when the session lookup fails', async () => {
    authState.user = currentUser
    vi.mocked(api.get).mockRejectedValue(new Error('401'))

    await loadCurrentUser()

    expect(authState.user).toBeNull()
    expect(authState.loading).toBe(false)
  })

  it('logs in and stores the returned user', async () => {
    vi.mocked(api.post).mockResolvedValue(currentUser)

    await login('brian@example.com', 'hunter2')

    expect(api.post).toHaveBeenCalledWith('/login', {
      email: 'brian@example.com',
      password: 'hunter2',
    })
    expect(authState.user).toEqual(currentUser)
  })

  it('logs out and clears the user', async () => {
    authState.user = currentUser
    vi.mocked(api.post).mockResolvedValue(undefined)

    await logout()

    expect(api.post).toHaveBeenCalledWith('/logout')
    expect(authState.user).toBeNull()
  })

  it('clears the user and flags the session as expired on an unauthorized response', () => {
    authState.user = currentUser

    handleUnauthorized()

    expect(authState.user).toBeNull()
    expect(authState.sessionExpired).toBe(true)
  })

  it('does not flag the session as expired when there was no logged-in user', () => {
    authState.user = null

    handleUnauthorized()

    expect(authState.user).toBeNull()
    expect(authState.sessionExpired).toBe(false)
  })
})
