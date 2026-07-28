import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import LogoutButton from './LogoutButton.svelte'

describe('LogoutButton', () => {
  it('calls onLogout when clicked', async () => {
    const onLogout = vi.fn()
    const { getByLabelText } = render(LogoutButton, { onLogout })
    await fireEvent.click(getByLabelText('Log out'))
    expect(onLogout).toHaveBeenCalled()
  })

  it('applies the requested padding', () => {
    const { container } = render(LogoutButton, { onLogout: vi.fn(), padding: 'p-2.5' })
    expect(container.querySelector('button')?.className).toContain('p-2.5')
  })
})
