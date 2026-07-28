import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeEmail, changePassword, updateUser } from '$lib/api/users'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '$lib/api/notification-preferences'
import {
  listPushSubscriptions,
  deletePushSubscription,
  sendTestPushNotification,
  type PushSubscriptionRecord,
} from '$lib/api/push-subscriptions'
import { pushState, subscribeToPush, unsubscribeFromPush } from '$lib/stores/push.svelte'
import { ApiError } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import SettingsPage from './+page.svelte'

vi.mock('$lib/api/users', () => ({
  updateUser: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('$lib/api/notification-preferences', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))
vi.mock('$lib/api/push-subscriptions', () => ({
  listPushSubscriptions: vi.fn(),
  deletePushSubscription: vi.fn(),
  sendTestPushNotification: vi.fn(),
}))
vi.mock('$lib/stores/push.svelte', () => ({
  pushState: { supported: true, secureContext: true, subscribed: false, loading: false },
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

const brian = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: '#4f46e5',
  initials: 'B',
}

const defaultPreferences: NotificationPreferences = {
  id: 1,
  userId: 1,
  enabled: false,
  leadDays: 3,
  notifyUtilityBills: true,
  notifyRecurringBills: true,
  notifySubscriptions: true,
  createdAt: '2026-01-01T00:00:00.000+00:00',
  updatedAt: null,
}

const deviceA: PushSubscriptionRecord = {
  id: 7,
  endpoint: 'https://push.example.com/a',
  userAgent: 'Test Browser',
  createdAt: '2026-01-27T03:00:00.000+00:00',
}

describe('settings page', () => {
  beforeEach(() => {
    authState.user = { ...brian }
    pushState.supported = true
    pushState.secureContext = true
    pushState.subscribed = false
    pushState.loading = false
    vi.mocked(getNotificationPreferences).mockReset().mockResolvedValue(defaultPreferences)
    vi.mocked(updateNotificationPreferences).mockReset()
    vi.mocked(listPushSubscriptions).mockReset().mockResolvedValue([])
    vi.mocked(deletePushSubscription).mockReset()
    vi.mocked(sendTestPushNotification).mockReset()
    vi.mocked(subscribeToPush).mockReset()
    vi.mocked(unsubscribeFromPush).mockReset()
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

  it('loads and shows the current notification preferences', async () => {
    vi.mocked(getNotificationPreferences).mockResolvedValue({
      ...defaultPreferences,
      enabled: true,
      leadDays: 5,
      notifyUtilityBills: false,
    })
    render(SettingsPage)

    const enabledCheckbox = (await screen.findByRole('checkbox', {
      name: 'Enabled',
    })) as HTMLInputElement
    expect(enabledCheckbox.checked).toBe(true)
    const utilityCheckbox = screen.getByRole('checkbox', {
      name: 'Utility bills',
    }) as HTMLInputElement
    expect(utilityCheckbox.checked).toBe(false)
  })

  it('shows an error when preferences fail to load', async () => {
    vi.mocked(getNotificationPreferences).mockRejectedValue(
      new ApiError(500, 'Could not load preferences')
    )
    render(SettingsPage)

    expect(await screen.findByText('Could not load preferences')).toBeInTheDocument()
  })

  it('saves notification preferences', async () => {
    vi.mocked(updateNotificationPreferences).mockResolvedValue({
      ...defaultPreferences,
      enabled: true,
    })
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('checkbox', { name: 'Enabled' }))
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(updateNotificationPreferences).toHaveBeenCalledWith({
      enabled: true,
      leadDays: 3,
      notifyUtilityBills: true,
      notifyRecurringBills: true,
      notifySubscriptions: true,
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('shows an error when saving notification preferences fails', async () => {
    vi.mocked(updateNotificationPreferences).mockRejectedValue(
      new ApiError(422, 'Invalid preferences')
    )
    const user = userEvent.setup()
    render(SettingsPage)

    await screen.findByRole('checkbox', { name: 'Enabled' })
    await user.click(screen.getAllByRole('button', { name: 'Save' })[2]!)

    expect(await screen.findByText('Invalid preferences')).toBeInTheDocument()
  })

  it('shows a message instead of device controls when push is unsupported', async () => {
    pushState.supported = false
    render(SettingsPage)

    expect(
      await screen.findByText("This browser doesn't support push notifications.")
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable on this device' })).not.toBeInTheDocument()
  })

  it('explains the HTTPS requirement when unsupported due to an insecure context', async () => {
    pushState.supported = false
    pushState.secureContext = false
    render(SettingsPage)

    expect(
      await screen.findByText(/Push notifications need this app served over HTTPS/)
    ).toBeInTheDocument()
    expect(
      screen.queryByText("This browser doesn't support push notifications.")
    ).not.toBeInTheDocument()
  })

  it('enables notifications on this device', async () => {
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Enable on this device' }))

    expect(subscribeToPush).toHaveBeenCalled()
    expect(unsubscribeFromPush).not.toHaveBeenCalled()
  })

  it('disables notifications on this device', async () => {
    pushState.subscribed = true
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Disable on this device' }))

    expect(unsubscribeFromPush).toHaveBeenCalled()
    expect(subscribeToPush).not.toHaveBeenCalled()
  })

  it('shows a placeholder when no devices are registered', async () => {
    render(SettingsPage)

    expect(await screen.findByText('No devices registered yet')).toBeInTheDocument()
  })

  it('lists registered devices and removes one', async () => {
    vi.mocked(listPushSubscriptions).mockResolvedValue([deviceA])
    vi.mocked(deletePushSubscription).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(SettingsPage)

    expect(await screen.findByText('Test Browser')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(deletePushSubscription).toHaveBeenCalledWith(7)
    expect(await screen.findByText('No devices registered yet')).toBeInTheDocument()
  })

  it('shows an error when removing a device fails', async () => {
    vi.mocked(listPushSubscriptions).mockResolvedValue([deviceA])
    vi.mocked(deletePushSubscription).mockRejectedValue(new ApiError(500, 'Remove failed'))
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Remove failed')).toBeInTheDocument()
  })

  it('sends a test notification', async () => {
    vi.mocked(sendTestPushNotification).mockResolvedValue({ sent: 1, pruned: 0, failed: 0 })
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }))

    expect(
      await screen.findByText('Test notification sent - check this device.')
    ).toBeInTheDocument()
  })

  it('reports when there are no active devices to send a test to', async () => {
    vi.mocked(sendTestPushNotification).mockResolvedValue({ sent: 0, pruned: 0, failed: 0 })
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }))

    expect(
      await screen.findByText(
        'No active devices to send to - enable notifications on this device first.'
      )
    ).toBeInTheDocument()
  })

  it('reports when the push service rejects delivery to a device', async () => {
    vi.mocked(sendTestPushNotification).mockResolvedValue({ sent: 0, pruned: 0, failed: 1 })
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }))

    expect(
      await screen.findByText(
        'The push service rejected the notification for this device - check the server logs for details.'
      )
    ).toBeInTheDocument()
  })

  it('shows an error when the test notification fails to send', async () => {
    vi.mocked(sendTestPushNotification).mockRejectedValue(new ApiError(500, 'Send failed'))
    const user = userEvent.setup()
    render(SettingsPage)

    await user.click(await screen.findByRole('button', { name: 'Send test notification' }))

    expect(await screen.findByText('Send failed')).toBeInTheDocument()
  })
})
