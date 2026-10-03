import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import SummaryStrip from './SummaryStrip.svelte'

const figures = [
  { label: 'Income', value: '$4,300.00', tone: 'in' as const, strong: true },
  { label: 'Outgoing', value: '$730.00', strong: true },
  { label: 'Net', value: '+$3,570.00', tone: 'in' as const, tint: 'in' as const, strong: true },
]

describe('SummaryStrip', () => {
  it('renders every figure label and value', () => {
    render(SummaryStrip, { figures })

    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('$4,300.00')).toBeInTheDocument()
    expect(screen.getByText('Outgoing')).toBeInTheDocument()
    expect(screen.getByText('$730.00')).toBeInTheDocument()
    expect(screen.getByText('Net')).toBeInTheDocument()
    expect(screen.getByText('+$3,570.00')).toBeInTheDocument()
  })

  it('uses tabular figures for the values', () => {
    render(SummaryStrip, { figures })

    expect(screen.getByText('$4,300.00')).toHaveClass('font-figures')
  })

  it('does not truncate values - the strip reflows to stacked rows below sm', () => {
    const { container } = render(SummaryStrip, { figures })

    expect(container.querySelector('.truncate')).toBeNull()
    const list = container.querySelector('dl')
    // Stacked (column) by default, side by side from `sm` up.
    expect(list).toHaveClass('flex-col', 'sm:flex-row')
    expect(list).toHaveClass('divide-y', 'sm:divide-x')
  })

  it('colours tones and leaves untinted values in ink', () => {
    render(SummaryStrip, { figures })

    expect(screen.getByText('$4,300.00')).toHaveClass('text-in')
    expect(screen.getByText('$730.00')).toHaveClass('text-ink')
  })

  it('washes a tinted cell background', () => {
    const { container } = render(SummaryStrip, { figures })

    expect(container.querySelector('.bg-in-tint')).not.toBeNull()
  })

  it('applies the roomy variant sizing', () => {
    render(SummaryStrip, { figures, variant: 'roomy' })

    expect(screen.getByText('$4,300.00')).toHaveClass('text-xl')
  })
})
