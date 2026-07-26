import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { authState, loadCurrentUser, login, logout } from './auth.svelte'

vi.mock('$lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const currentUser = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: '#000000',
  initials: 'B',
}

describe('auth store', () => {
  beforeEach(() => {
    authState.user = null
    authState.loading = true
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
})
