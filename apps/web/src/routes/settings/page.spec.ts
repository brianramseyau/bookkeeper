import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeEmail, changePassword, updateUser } from '$lib/api/users'
import { ApiError } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import SettingsPage from './+page.svelte'

vi.mock('$lib/api/users', () => ({
  updateUser: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
}))

const brian = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: '#4f46e5',
  initials: 'B',
}

describe('settings page', () => {
  beforeEach(() => {
    authState.user = { ...brian }
  })

  it('saves the display color', async () => {
    vi.mocked(updateUser).mockResolvedValue({ ...brian, displayColor: '#000000' })
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(updateUser).toHaveBeenCalledWith(1, { displayColor: '#4f46e5' })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows an error when saving the display color fails', async () => {
    vi.mocked(updateUser).mockRejectedValue(new ApiError(500, 'Could not save color'))
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!)

    expect(await screen.findByText('Could not save color')).toBeInTheDocument()
  })

  it('requires a non-empty email before submitting', async () => {
    const user = userEvent.setup()
    render(SettingsPage)

    const emailInput = screen.getByLabelText('New email')
    await user.clear(emailInput)
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]!)

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(changeEmail).not.toHaveBeenCalled()
  })

  it('changes the email on success', async () => {
    vi.mocked(changeEmail).mockResolvedValue({ ...brian, email: 'new@example.com' })
    const user = userEvent.setup()
    render(SettingsPage)

    await user.type(screen.getAllByLabelText('Current password')[0]!, 'hunter2')
    const emailInput = screen.getByLabelText('New email')
    await user.clear(emailInput)
    await user.type(emailInput, 'new@example.com')
    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]!)

    expect(changeEmail).toHaveBeenCalledWith(1, {
      currentPassword: 'hunter2',
      newEmail: 'new@example.com',
    })
    expect(await screen.findByText('Email updated.')).toBeInTheDocument()
    expect(authState.user?.email).toBe('new@example.com')
  })

  it('shows an API error when changing email fails', async () => {
    vi.mocked(changeEmail).mockRejectedValue(new ApiError(401, 'Wrong password'))
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(screen.getAllByRole('button', { name: 'Save' })[1]!)

    expect(await screen.findByText('Wrong password')).toBeInTheDocument()
  })

  it('rejects a new password shorter than 8 characters', async () => {
    const user = userEvent.setup()
    render(SettingsPage)

    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(
      await screen.findByText('New password must be at least 8 characters')
    ).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched new passwords', async () => {
    const user = userEvent.setup()
    render(SettingsPage)

    await user.type(screen.getByLabelText('New password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm new password'), 'longenough2')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('New passwords do not match')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('changes the password on success', async () => {
    vi.mocked(changePassword).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(SettingsPage)

    await user.type(screen.getAllByLabelText('Current password')[1]!, 'oldpass')
    await user.type(screen.getByLabelText('New password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm new password'), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(changePassword).toHaveBeenCalledWith(1, {
      currentPassword: 'oldpass',
      newPassword: 'longenough1',
    })
    expect(await screen.findByText('Password changed.')).toBeInTheDocument()
  })

  it('shows an API error when changing password fails', async () => {
    vi.mocked(changePassword).mockRejectedValue(new ApiError(401, 'Current password is wrong'))
    const user = userEvent.setup()
    render(SettingsPage)

    await user.type(screen.getByLabelText('New password'), 'longenough1')
    await user.type(screen.getByLabelText('Confirm new password'), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Current password is wrong')).toBeInTheDocument()
  })
})
