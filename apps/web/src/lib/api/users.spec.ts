import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { changeEmail, changePassword, listUsers, updateUser } from './users'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), patch: vi.fn() },
}))

describe('users api', () => {
  it('lists users', () => {
    listUsers()
    expect(api.get).toHaveBeenCalledWith('/users')
  })

  it('updates a user', () => {
    updateUser(1, { displayColor: '#123456' })
    expect(api.patch).toHaveBeenCalledWith('/users/1', { displayColor: '#123456' })
  })

  it('changes a password', () => {
    changePassword(1, { currentPassword: 'old', newPassword: 'new' })
    expect(api.put).toHaveBeenCalledWith('/users/1/password', {
      currentPassword: 'old',
      newPassword: 'new',
    })
  })

  it('changes an email', () => {
    changeEmail(1, { currentPassword: 'old', newEmail: 'new@example.com' })
    expect(api.put).toHaveBeenCalledWith('/users/1/email', {
      currentPassword: 'old',
      newEmail: 'new@example.com',
    })
  })
})
