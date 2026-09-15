import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PushSubscriptionRecord } from '$lib/api/push-subscriptions'
import DeviceList from './DeviceList.svelte'

const deviceA: PushSubscriptionRecord = {
  id: 7,
  endpoint: 'https://push.example.com/a',
  userAgent: 'Test Browser',
  createdAt: '2026-01-27T03:00:00.000+00:00',
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    devices: [deviceA],
    loading: false,
    deletingDeviceId: null,
    onDelete: vi.fn(),
    ...overrides,
  }
}

describe('DeviceList', () => {
  it('shows a loading skeleton while loading', () => {
    render(DeviceList, baseProps({ devices: [], loading: true }))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows an empty state when no devices are registered', () => {
    render(DeviceList, baseProps({ devices: [] }))
    expect(screen.getByText('No devices registered yet')).toBeInTheDocument()
  })

  it('renders a device and reports deletes', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(DeviceList, baseProps({ onDelete }))

    expect(screen.getByText('Test Browser')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Delete Test Browser' })[0]!)
    expect(onDelete).toHaveBeenCalledWith(deviceA)
  })

  it('disables the delete button while that device is being removed', () => {
    render(DeviceList, baseProps({ deletingDeviceId: 7 }))

    for (const button of screen.getAllByRole('button', { name: 'Delete Test Browser' })) {
      expect(button).toBeDisabled()
    }
  })
})
