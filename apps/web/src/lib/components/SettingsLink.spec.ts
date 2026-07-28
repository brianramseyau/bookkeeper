import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import SettingsLink from './SettingsLink.svelte'

describe('SettingsLink', () => {
  it('links to /settings', () => {
    const { container } = render(SettingsLink, {
      user: { fullName: 'Brian', email: 'brian@example.com', displayColor: '#4f46e5' },
    })
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/settings')
  })

  it('labels itself with the user full name when present', () => {
    const { getByLabelText } = render(SettingsLink, {
      user: { fullName: 'Brian', email: 'brian@example.com', displayColor: '#4f46e5' },
    })
    expect(getByLabelText('Settings for Brian')).toBeInTheDocument()
  })

  it('falls back to email when full name is null', () => {
    const { getByLabelText } = render(SettingsLink, {
      user: { fullName: null, email: 'brian@example.com', displayColor: null },
    })
    expect(getByLabelText('Settings for brian@example.com')).toBeInTheDocument()
  })

  it('uses the display color as the icon color style', () => {
    const { container } = render(SettingsLink, {
      user: { fullName: 'Brian', email: 'brian@example.com', displayColor: '#4f46e5' },
    })
    // jsdom normalizes hex colors in the style attribute to rgb().
    expect(container.querySelector('a')?.getAttribute('style')).toContain('rgb(79, 70, 229)')
  })

  it('falls back to a default color when displayColor is null', () => {
    const { container } = render(SettingsLink, {
      user: { fullName: 'Brian', email: 'brian@example.com', displayColor: null },
    })
    expect(container.querySelector('a')?.getAttribute('style')).toContain('rgb(148, 163, 184)')
  })

  it('applies the requested padding', () => {
    const { container } = render(SettingsLink, {
      user: { fullName: 'Brian', email: 'brian@example.com', displayColor: null },
      padding: 'p-2.5',
    })
    expect(container.querySelector('a')?.className).toContain('p-2.5')
  })
})
