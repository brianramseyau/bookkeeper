import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import ExportPage from './+page.svelte'

describe('export page', () => {
  it('links the JSON export and every CSV table download', () => {
    render(ExportPage)

    const jsonLink = screen.getByRole('link', { name: 'Download JSON' })
    expect(jsonLink.getAttribute('href')).toBe('/api/export/json')

    const csvLinks = screen.getAllByRole('link', { name: 'Download CSV' })
    expect(csvLinks).toHaveLength(8)
    expect(csvLinks.map((link) => link.getAttribute('href'))).toContain(
      '/api/export/csv/income-entries'
    )
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Income entries')).toBeInTheDocument()
  })
})
