export type Theme = 'light' | 'dark'

export interface AvatarColors {
  background: string
  foreground: '#000000' | '#FFFFFF'
}

/**
 * Narrow any hex CSS colour (`#rgb`, `#rrggbb`, `#rrggbbaa`) to `#rrggbb`;
 * anything else (named colours, garbage from the one-off workbook import)
 * returns `null`.
 */
function toRgbHex(color: string): string | null {
  const value = color.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{8}$/.test(value)) return value.slice(0, 7)
  return null
}

/** WCAG 2.x relative luminance of an sRGB `#rrggbb` colour. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

// Pure black/white contrast curves cross at luminance ~0.179, where both
// still clear 4.5:1, so picking the winner yields an AA-readable foreground
// for any background we can parse.
const CONTRAST_PIVOT = 0.179

/**
 * Black or white, whichever contrasts more against `color`. Use only for a
 * glyph sitting on a solid fill of an arbitrary user-chosen colour (the
 * account menu's initials); app text should use the `ink` token instead.
 * Unparseable input returns white so the caller does not paint an unreadable
 * pair - prefer {@link avatarColors}, which also controls the fill.
 */
export function readableTextColor(color: string | null | undefined): '#000000' | '#FFFFFF' {
  const hex = color ? toRgbHex(color) : null
  if (!hex) return '#FFFFFF'
  return relativeLuminance(hex) > CONTRAST_PIVOT ? '#000000' : '#FFFFFF'
}

/**
 * The solid fill and readable foreground for the account avatar's initials.
 * Background and foreground always come from the same decision: a parseable
 * colour is used (normalised) with black/white picked per luminance, and
 * anything else falls back to the `muted-ink` token with the foreground
 * chosen for the theme that token resolves to - so the initials never end up
 * white-on-light just because a stored `displayColor` wasn't valid hex.
 */
export function avatarColors(color: string | null | undefined, theme: Theme): AvatarColors {
  const hex = color ? toRgbHex(color) : null
  if (!hex) {
    return {
      background: 'var(--muted-ink)',
      foreground: theme === 'dark' ? '#000000' : '#FFFFFF',
    }
  }
  return { background: hex, foreground: readableTextColor(hex) }
}
