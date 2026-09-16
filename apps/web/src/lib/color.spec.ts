import { describe, expect, it } from 'vitest'
import { avatarColors, readableTextColor } from './color'

describe('readableTextColor', () => {
  it('picks black for light backgrounds and white for dark ones', () => {
    expect(readableTextColor('#FFFFFF')).toBe('#000000')
    expect(readableTextColor('#000000')).toBe('#FFFFFF')
  })

  it('picks the higher-contrast choice for a mid-tone hue', () => {
    // #6366f1 is the demo user's displayColor: white is only 4.46:1, black
    // is 4.71:1, so the avatar must not hardcode white text.
    expect(readableTextColor('#6366f1')).toBe('#000000')
    expect(readableTextColor('#0A6B50')).toBe('#FFFFFF')
  })

  it('accepts #rgb and #rrggbbaa shorthand', () => {
    expect(readableTextColor('#fff')).toBe('#000000')
    expect(readableTextColor('#6366f1ff')).toBe('#000000')
  })

  it('falls back to white when there is no parseable colour', () => {
    expect(readableTextColor(undefined)).toBe('#FFFFFF')
    expect(readableTextColor(null)).toBe('#FFFFFF')
    expect(readableTextColor('yellow')).toBe('#FFFFFF')
  })
})

describe('avatarColors', () => {
  it('returns a normalised fill with its readable foreground', () => {
    expect(avatarColors('#6366f1', 'light')).toEqual({
      background: '#6366f1',
      foreground: '#000000',
    })
    expect(avatarColors('#0a6b50', 'dark')).toEqual({
      background: '#0a6b50',
      foreground: '#FFFFFF',
    })
  })

  it('falls back to the muted-ink token with a theme-aware foreground', () => {
    // var(--muted-ink) is dark in light mode and light in dark mode, so the
    // foreground flips with it rather than always assuming a dark fill.
    expect(avatarColors(null, 'light')).toEqual({
      background: 'var(--muted-ink)',
      foreground: '#FFFFFF',
    })
    expect(avatarColors(null, 'dark')).toEqual({
      background: 'var(--muted-ink)',
      foreground: '#000000',
    })
  })

  it('never paints an unparseable colour', () => {
    expect(avatarColors('yellow', 'light').background).toBe('var(--muted-ink)')
  })
})
