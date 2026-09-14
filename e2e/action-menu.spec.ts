import { test, expect } from '@playwright/test'

// Regression test for the ActionMenu clipping bug: before its Phase 0
// rebuild on bits-ui's portalled, collision-aware DropdownMenu, the popover
// was `absolute`-positioned inside the table's own `overflow-x-auto` card
// and always opened downward - so a row near the bottom of the viewport
// (typically the last one) had its menu clipped or entirely invisible. A
// short viewport plus scrolling to the bottom of the page reliably forces
// that "near the bottom edge" condition regardless of how many rows the
// seeded data happens to have.
test('the last row action menu on Expenses opens fully inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 500 })
  await page.goto('/expenses')

  await expect(page.getByRole('heading', { name: 'Expenses', level: 1 })).toBeVisible()
  const menuButtons = page.getByRole('button', { name: /^Actions for/ })
  await expect(menuButtons.first()).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const lastTrigger = menuButtons.last()
  await lastTrigger.scrollIntoViewIfNeeded()
  await lastTrigger.click()

  // Check the menu container itself, not just one item inside it - a menu
  // that opens downward with too little room below could still leave its
  // first item (Edit) on-screen while later ones (Pause/Archive) are cut
  // off, which would pass this regression test in exactly the failure mode
  // it exists to catch.
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()

  const box = await menu.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (box && viewport) {
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
})
