import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import DesignSpecimenPage from './+page.svelte'

vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn().mockResolvedValue(true),
}))

describe('Design specimen page', () => {
  it('renders the Polymer tokens, type and primitives specimen', () => {
    render(DesignSpecimenPage)

    expect(screen.getByRole('heading', { name: 'Design specimen' })).toBeInTheDocument()
    expect(screen.getByText('Colour')).toBeInTheDocument()
    expect(screen.getByText('Stats')).toBeInTheDocument()
  })
})
