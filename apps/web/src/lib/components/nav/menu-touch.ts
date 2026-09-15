/**
 * Extra sizing for dropdown menu items on touch devices, applied on top of
 * the vendored shadcn item's compact `px-1.5 py-1` (≈28px tall - a mouse
 * target, not a comfortable thumb target).
 *
 * Gated behind `pointer-coarse:` so mouse users keep the compact desktop
 * sizing; a coarse pointer gets a ≥44px row instead. Used by the app-level
 * menus in this folder (the bottom tab bar's Outgoings/More overlays are the
 * main one). See DESIGN.md → Quality floor.
 */
export const TOUCH_MENU_ITEM = 'pointer-coarse:min-h-11 pointer-coarse:px-3 pointer-coarse:py-2.5'
