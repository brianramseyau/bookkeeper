import { describe, expect, it } from 'vitest'
import { readableTextColor } from './color'

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

  it('falls back to white when there is no valid colour', () => {
    expect(readableTextColor(undefined)).toBe('#FFFFFF')
    expect(readableTextColor(null)).toBe('#FFFFFF')
    expect(readableTextColor('not-a-colour')).toBe('#FFFFFF')
  })
})
