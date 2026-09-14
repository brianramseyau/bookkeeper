import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import EmptyState from './EmptyState.svelte'

describe('EmptyState', () => {
  it('renders the message', () => {
    render(EmptyState, { message: 'No bills yet. Add the first one to see when it’s due.' })

    expect(
      screen.getByText('No bills yet. Add the first one to see when it’s due.')
    ).toBeInTheDocument()
  })

  it('renders no action by default', () => {
    render(EmptyState, { message: 'No bills yet.' })

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders the action snippet under the message', () => {
    const action = createRawSnippet(() => ({
      render: () => '<button type="button">Add bill</button>',
    }))
    render(EmptyState, { message: 'No bills yet.', action })

    expect(screen.getByRole('button', { name: 'Add bill' })).toBeInTheDocument()
  })
})
