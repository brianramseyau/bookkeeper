import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import { page } from '$app/state'
import ErrorPage from './+error.svelte'

vi.mock('$app/state', () => ({
  page: { status: 404, error: { message: 'Not Found' } },
}))

describe('+error.svelte', () => {
  it('shows a friendly message for an unmatched route (404)', () => {
    page.status = 404
    page.error = { message: 'Not Found' }

    render(ErrorPage)

    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(
      screen.getByText("The page you're looking for doesn't exist or has moved.")
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/')
  })

  it('shows the error message for a non-404 status', () => {
    page.status = 500
    page.error = { message: 'Something broke' }

    render(ErrorPage)

    expect(screen.getByText('Something went wrong (500)')).toBeInTheDocument()
    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })

  it('falls back to a generic message when there is no error detail', () => {
    page.status = 500
    page.error = null

    render(ErrorPage)

    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument()
  })
})
