import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto } from '$app/navigation'
import { login } from '$lib/stores/auth.svelte'
import { ApiError } from '$lib/api'
import LoginPage from './+page.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
vi.mock('$lib/stores/auth.svelte', () => ({ login: vi.fn() }))

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'brian@example.com')
  await user.type(screen.getByLabelText('Password'), 'hunter2')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

describe('login page', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset()
    vi.mocked(goto).mockReset()
  })

  it('logs in and redirects to the dashboard on success', async () => {
    vi.mocked(login).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(LoginPage)

    await fillAndSubmit(user)

    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'))
    expect(login).toHaveBeenCalledWith('brian@example.com', 'hunter2')
  })

  it('shows the API error message on failure', async () => {
    vi.mocked(login).mockRejectedValue(new ApiError(401, 'Invalid credentials'))
    const user = userEvent.setup()
    render(LoginPage)

    await fillAndSubmit(user)

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
    expect(goto).not.toHaveBeenCalled()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(login).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(LoginPage)

    await fillAndSubmit(user)

    expect(await screen.findByText('Something went wrong, try again.')).toBeInTheDocument()
  })
})
