import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import LostPiggyIllustration from './LostPiggyIllustration.svelte'

describe('LostPiggyIllustration', () => {
  it('renders an accessible svg illustration', () => {
    const { container } = render(LostPiggyIllustration)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('aria-label', 'A confused piggy bank looking for the missing page')
  })

  it('defaults to a h-40 w-40 size', () => {
    const { container } = render(LostPiggyIllustration)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('h-40 w-40')
  })

  it('allows overriding the size class', () => {
    const { container } = render(LostPiggyIllustration, { class: 'h-24 w-24' })
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('h-24 w-24')
    expect(svg?.getAttribute('class')).not.toContain('h-40 w-40')
  })
})
