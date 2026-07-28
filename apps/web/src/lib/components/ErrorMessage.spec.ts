import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ErrorMessage from './ErrorMessage.svelte'

describe('ErrorMessage', () => {
  it('renders the message text', () => {
    const { getByText } = render(ErrorMessage, { message: 'Failed to load' })
    expect(getByText('Failed to load')).toBeInTheDocument()
  })

  it('uses red text classes and a default mt-3 margin', () => {
    const { container } = render(ErrorMessage, { message: 'Oops' })
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-red-600')
    expect(p?.className).toContain('mt-3')
  })

  it('allows overriding the margin class', () => {
    const { container } = render(ErrorMessage, { message: 'Oops', class: 'mt-6' })
    const p = container.querySelector('p')
    expect(p?.className).toContain('mt-6')
    expect(p?.className).not.toContain('mt-3')
  })
})
