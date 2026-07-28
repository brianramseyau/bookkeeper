import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import TrendIndicator from './TrendIndicator.svelte'

describe('TrendIndicator', () => {
  it('renders nothing when trend is null', () => {
    const { container } = render(TrendIndicator, { trend: null })
    expect(container.textContent).toBe('')
  })

  it('renders nothing when trend is undefined', () => {
    const { container } = render(TrendIndicator, { trend: undefined })
    expect(container.textContent).toBe('')
  })

  it('renders the up label in red', () => {
    const { getByText } = render(TrendIndicator, { trend: 'up' })
    const el = getByText('▲ up')
    expect(el.className).toContain('text-red-600')
  })

  it('renders the down label in emerald', () => {
    const { getByText } = render(TrendIndicator, { trend: 'down' })
    const el = getByText('▼ down')
    expect(el.className).toContain('text-emerald-600')
  })

  it('renders the flat label in slate', () => {
    const { getByText } = render(TrendIndicator, { trend: 'flat' })
    const el = getByText('— flat')
    expect(el.className).toContain('text-slate-400')
  })

  it('appends a suffix when provided', () => {
    const { getByText } = render(TrendIndicator, { trend: 'up', suffix: ' on trailing average' })
    expect(getByText('▲ up on trailing average')).toBeInTheDocument()
  })

  it('never appends a suffix to the flat label', () => {
    const { getByText } = render(TrendIndicator, { trend: 'flat', suffix: ' on trailing average' })
    expect(getByText('— flat')).toBeInTheDocument()
  })

  it('renders as a span by default', () => {
    const { container } = render(TrendIndicator, { trend: 'up' })
    expect(container.querySelector('span')).not.toBeNull()
    expect(container.querySelector('p')).toBeNull()
  })

  it('renders as a paragraph when as="p"', () => {
    const { container } = render(TrendIndicator, { trend: 'up', as: 'p' })
    expect(container.querySelector('p')).not.toBeNull()
  })
})
