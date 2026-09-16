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

async function onlyMenuBox(page: Page) {
  // Wait for any menu that's animating out to unmount, so exactly one remains.
  const menus = page.locator('[data-mobile-bottom-menu]')
  await expect(menus).toHaveCount(1)
  const box = await menus.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

test('bottom tab bar menus share a bottom-right anchor and switch on one tap', async ({ page }) => {
  await page.goto('/')
  const outgoings = page.getByRole('button', { name: 'Outgoings' })
  const more = page.getByRole('button', { name: 'More' })

  await outgoings.click()
  await expect(outgoings).toHaveAttribute('aria-expanded', 'true')
  const outgoingBox = await onlyMenuBox(page)

  // Tapping the other tab swaps menus in one tap (not close-then-open).
  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await expect(outgoings).toHaveAttribute('aria-expanded', 'false')
  const accountBox = await onlyMenuBox(page)

  expect(outgoingBox.x + outgoingBox.width).toBeCloseTo(374, 0)
  expect(accountBox.x + accountBox.width).toBeCloseTo(374, 0)
  expect(accountBox.y + accountBox.height).toBeCloseTo(outgoingBox.y + outgoingBox.height, 0)
})

test('a tap on page content while a tab bar menu is open only dismisses it', async ({ page }) => {
  await page.goto('/bills')
  await page.getByRole('button', { name: 'Outgoings' }).click()
  await expect(page.getByRole('menuitem').first()).toBeVisible()

  // Tap at a row link's location: the menu's scroll lock keeps the tap from
  // reaching the link, so it dismisses rather than navigating. Assert the
  // coordinates are on-screen and not covered by the menu/tab bar, or a click
  // on one of those could pass the test without exercising the content path.
  const link = page.getByRole('link', { name: 'Childcare' })
  await link.scrollIntoViewIfNeeded()
  const row = await link.boundingBox()
  if (!row) throw new Error('Childcare row has no bounding box')
  expect(row.y).toBeGreaterThanOrEqual(0)
  expect(row.y + row.height).toBeLessThanOrEqual(844)

  const x = row.x + row.width / 2
  const y = row.y + row.height / 2
  const overlays = await page.evaluate(
    ([px, py]) => {
      const element = document.elementFromPoint(px, py)
      return {
        menu: Boolean(element?.closest('[data-mobile-bottom-menu]')),
        tabBar: Boolean(element?.closest('[data-mobile-tab-bar]')),
      }
    },
    [x, y]
  )
  expect(overlays).toEqual({ menu: false, tabBar: false })

  await page.mouse.click(x, y)

  await expect(page.getByRole('menuitem')).toHaveCount(0)
  await expect(page).toHaveURL(/\/bills$/)
})

test('row action menu items are at least 44px tall', async ({ page }) => {
  await page.goto('/bills')
  await page
    .getByRole('button', { name: /^Actions for/ })
    .first()
    .click()
  await expectMenuItemsAtLeast44(page)
})
