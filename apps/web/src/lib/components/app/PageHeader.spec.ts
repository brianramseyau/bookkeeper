import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import PageHeader from './PageHeader.svelte'

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(PageHeader, { title: 'Bills' })

    expect(screen.getByRole('heading', { level: 1, name: 'Bills' })).toBeInTheDocument()
  })

  it('renders no back link or description by default', () => {
    render(PageHeader, { title: 'Bills' })

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders a description under the title when given one', () => {
    render(PageHeader, { title: 'Bills', description: 'What we pay for.' })

    expect(screen.getByText('What we pay for.')).toBeInTheDocument()
  })

  it('renders a back link above the title when given one', () => {
    render(PageHeader, { title: 'Groceries', back: { href: '/expenses', label: 'Expenses' } })

    const link = screen.getByRole('link', { name: '← Expenses' })
    expect(link).toHaveAttribute('href', '/expenses')
  })

  it('renders the actions snippet next to the title', () => {
    const actions = createRawSnippet(() => ({
      render: () => '<button type="button">Add bill</button>',
    }))
    render(PageHeader, { title: 'Bills', actions })

    expect(screen.getByRole('button', { name: 'Add bill' })).toBeInTheDocument()
  })

  it('sets the document title from the visible title by default', () => {
    render(PageHeader, { title: 'Bills' })

    expect(document.title).toBe('Bills · Bookkeeper')
  })

  it('uses documentTitle for the tab when it differs from the h1', () => {
    render(PageHeader, { title: 'Welcome, Brian', documentTitle: 'Dashboard' })

    expect(document.title).toBe('Dashboard · Bookkeeper')
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Brian' })).toBeInTheDocument()
  })
})
