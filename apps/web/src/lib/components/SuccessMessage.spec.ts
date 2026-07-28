import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import SuccessMessage from './SuccessMessage.svelte'

describe('SuccessMessage', () => {
  it('renders the message text', () => {
    const { getByText } = render(SuccessMessage, { message: 'Saved.' })
    expect(getByText('Saved.')).toBeInTheDocument()
  })

  it('uses emerald text classes and a default mt-3 margin', () => {
    const { container } = render(SuccessMessage, { message: 'Saved.' })
    const p = container.querySelector('p')
    expect(p?.className).toContain('text-emerald-600')
    expect(p?.className).toContain('mt-3')
  })

  it('allows overriding the margin class', () => {
    const { container } = render(SuccessMessage, { message: 'Saved.', class: 'mt-1' })
    const p = container.querySelector('p')
    expect(p?.className).toContain('mt-1')
    expect(p?.className).not.toContain('mt-3')
  })
})
