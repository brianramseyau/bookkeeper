import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import StatCard from './StatCard.svelte'

describe('StatCard', () => {
  it('renders the label and pre-formatted value', () => {
    render(StatCard, { label: 'Projected net', value: '$1,240.00' })

    expect(screen.getByText('Projected net')).toBeInTheDocument()
    expect(screen.getByText('$1,240.00')).toBeInTheDocument()
  })

  it('renders no hint by default', () => {
    const { container } = render(StatCard, { label: 'Projected net', value: '$1,240.00' })

    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('renders a hint under the value when given one', () => {
    render(StatCard, {
      label: 'Projected net',
      value: '$1,240.00',
      hint: 'Carried over plus projected income, minus projected expenses.',
    })

    expect(
      screen.getByText('Carried over plus projected income, minus projected expenses.')
    ).toBeInTheDocument()
  })

  it('colours the value ink by default, with no tone glyph', () => {
    render(StatCard, { label: 'Cash on hand', value: '$500.00' })

    expect(screen.getByText('$500.00')).toHaveClass('text-foreground')
    expect(screen.queryByText('▲')).toBeNull()
    expect(screen.queryByText('▼')).toBeNull()
  })

  it('colours the value in and shows an up glyph for a positive tone', () => {
    render(StatCard, { label: 'Projected net', value: '$1,240.00', tone: 'positive' })

    expect(screen.getByText('$1,240.00')).toHaveClass('text-in')
    // DESIGN.md: status is never shown by colour alone - the glyph is the
    // non-colour signal, since `value` is pre-formatted by the caller and
    // doesn't necessarily carry its own +/- sign (see /_design's specimen).
    expect(screen.getByText('▲')).toHaveClass('text-in')
  })

  it('colours the value over and shows a down glyph for a negative tone', () => {
    render(StatCard, { label: 'Variance', value: '-$80.00', tone: 'negative' })

    expect(screen.getByText('-$80.00')).toHaveClass('text-over')
    expect(screen.getByText('▼')).toHaveClass('text-over')
  })

  it('renders the value with tabular figures', () => {
    render(StatCard, { label: 'Projected net', value: '$1,240.00' })

    expect(screen.getByText('$1,240.00')).toHaveClass('font-figures')
  })
})
