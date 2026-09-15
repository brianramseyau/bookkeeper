/** WCAG 2.x relative luminance of an sRGB `#rrggbb` colour. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

// Pure black/white contrast curves cross at luminance ~0.179, where both
// still clear 4.5:1, so picking the winner always yields an AA-readable
// foreground for any background. (The user's own `displayColor` can be any
// hue, so the account avatar can't assume a fixed one.)
const CONTRAST_PIVOT = 0.179

/**
 * Black or white, whichever contrasts more against `color`. Use only for a
 * glyph sitting on a solid fill of an arbitrary user-chosen colour (the
 * account menu's initials); app text should use the `ink` token instead.
 */
export function readableTextColor(color: string | null | undefined): '#000000' | '#FFFFFF' {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return '#FFFFFF'
  return relativeLuminance(color) > CONTRAST_PIVOT ? '#000000' : '#FFFFFF'
}
