import { render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { themeState } from '$lib/stores/theme.svelte'
import Sparkline from './Sparkline.svelte'

afterEach(() => {
  themeState.current = 'light'
})

describe('Sparkline', () => {
  it('renders nothing with fewer than two values', () => {
    const { container } = render(Sparkline, { values: [5], trend: null })
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders nothing with no values', () => {
    const { container } = render(Sparkline, { values: [], trend: 'flat' })
    expect(container.querySelector('svg')).toBeNull()
  })

  it('draws a path and end marker for two or more values', () => {
    const { container } = render(Sparkline, { values: [10, 20, 15], trend: 'up' })
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(container.querySelector('path')).not.toBeNull()
    expect(container.querySelector('circle')).not.toBeNull()
  })

  it('handles a flat series (zero range) without NaN coordinates', () => {
    const { container } = render(Sparkline, { values: [10, 10, 10], trend: 'flat' })
    const path = container.querySelector('path')
    expect(path?.getAttribute('d')).not.toContain('NaN')
  })

  it('uses the down trend color', () => {
    const { container } = render(Sparkline, { values: [10, 5], trend: 'down' })
    const path = container.querySelector('path')
    expect(path?.getAttribute('stroke')).toBe('#059669')
  })

  it('uses the neutral color when trend is null', () => {
    const { container } = render(Sparkline, { values: [10, 5], trend: null })
    const path = container.querySelector('path')
    expect(path?.getAttribute('stroke')).toBe('#cbd5e1')
  })

  it('uses dark-mode colors when the theme is dark', () => {
    themeState.current = 'dark'
    const { container } = render(Sparkline, { values: [10, 5], trend: 'down' })
    const path = container.querySelector('path')
    const circle = container.querySelector('circle')
    expect(path?.getAttribute('stroke')).toBe('#34d399')
    expect(circle?.getAttribute('stroke')).toBe('#1e293b')
  })

  it('respects custom width and height', () => {
    const { container } = render(Sparkline, {
      values: [1, 2],
      trend: 'flat',
      width: 200,
      height: 50,
    })
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('200')
    expect(svg?.getAttribute('height')).toBe('50')
  })
})
