import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import LoadingIndicator from './LoadingIndicator.svelte'

describe('LoadingIndicator', () => {
  it('renders the loading text', () => {
    const { getByText } = render(LoadingIndicator)
    expect(getByText('Loading…')).toBeInTheDocument()
  })

  it('defaults to a mt-6 margin', () => {
    const { container } = render(LoadingIndicator)
    const p = container.querySelector('p')
    expect(p?.className).toContain('mt-6')
  })

  it('allows overriding the margin class', () => {
    const { container } = render(LoadingIndicator, { class: 'mt-3' })
    const p = container.querySelector('p')
    expect(p?.className).toContain('mt-3')
    expect(p?.className).not.toContain('mt-6')
  })
})
