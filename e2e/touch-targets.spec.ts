import { test, expect, type Page } from '@playwright/test'

// The bottom tab bar and row menus are only reachable on coarse-pointer
// devices, and the axe sweep never opens a menu - so this is the automated
// check that the touch-target sizing (DESIGN.md → Quality floor) actually
// renders at ≥44px. `hasTouch` is what makes Chromium report `pointer: coarse`.
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

async function expectMenuItemsAtLeast44(page: Page) {
  await expect(page.getByRole('menuitem').first()).toBeVisible()

  // Use offsetHeight, not boundingBox - the menu opens with a `zoom-in-95`
  // transition, so a bounding box sampled mid-animation can read <44.
  const heights = await page
    .getByRole('menuitem')
    .evaluateAll((items) => items.map((item) => item.offsetHeight))

  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44)
}

test('bottom tab bar overlay menu items are at least 44px tall', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Outgoings' }).click()
  await expectMenuItemsAtLeast44(page)
})

test('row action menu items are at least 44px tall', async ({ page }) => {
  await page.goto('/bills')
  await page.getByRole('button', { name: /^Actions for/ }).first().click()
  await expectMenuItemsAtLeast44(page)
})
