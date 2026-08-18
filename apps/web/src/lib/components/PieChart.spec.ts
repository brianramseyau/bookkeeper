import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import PieChart, { type PieSlice } from './PieChart.svelte'

describe('PieChart', () => {
  const data: PieSlice[] = [
    { label: 'Salary', value: 12000, color: '#4f46e5' },
    { label: 'Other', value: 3000, color: '#94a3b8' },
  ]

  it('renders a donut and legend with percentages', () => {
    render(PieChart, { data })

    expect(screen.getByRole('img', { name: 'Donut chart with 2 slices' })).toBeInTheDocument()
    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('shows the total in the centre', () => {
    render(PieChart, { data })

    expect(screen.getByText('$15,000.00')).toBeInTheDocument()
  })

  it('draws a single full ring when there is only one slice', () => {
    render(PieChart, { data: [{ label: 'Salary', value: 5000, color: '#4f46e5' }] })

    expect(screen.queryByRole('img', { name: 'Donut chart with 1 slice' })).toBeInTheDocument()
  })

  it('renders the empty message when there is no income', () => {
    render(PieChart, {
      data: [],
      emptyMessage: 'No income logged this year',
    })

    expect(screen.getByText('No income logged this year')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('skips zero-value slices from the ring and legend', () => {
    render(PieChart, {
      data: [
        { label: 'Salary', value: 4000, color: '#4f46e5' },
        { label: 'Empty', value: 0, color: '#94a3b8' },
      ],
    })

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.queryByText('Empty')).not.toBeInTheDocument()
  })

  it('renders custom centre content via the center snippet instead of the total', () => {
    const centerSnippet = createRawSnippet(() => ({
      render: () => '<span class="text-emerald-600">Custom centre</span>',
    }))
    render(PieChart, { data, center: centerSnippet })

    expect(screen.getByText('Custom centre')).toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })
})
