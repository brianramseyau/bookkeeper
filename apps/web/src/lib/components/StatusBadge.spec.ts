import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import StatusBadge from './StatusBadge.svelte'

describe('StatusBadge', () => {
  it('renders the label text', () => {
    const { getByText } = render(StatusBadge, { label: 'Paused', tone: 'amber' })
    expect(getByText('Paused')).toBeInTheDocument()
  })

  it('uses amber tone classes', () => {
    const { getByText } = render(StatusBadge, { label: 'Paused', tone: 'amber' })
    expect(getByText('Paused').className).toContain('bg-amber-100')
  })

  it('uses slate tone classes', () => {
    const { getByText } = render(StatusBadge, { label: 'Archived', tone: 'slate' })
    expect(getByText('Archived').className).toContain('bg-slate-200')
  })
})
