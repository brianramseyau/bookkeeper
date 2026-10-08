import { test, expect } from '@playwright/test'

// The month picker shares one session store across Dashboard and Monthly (the
// app shell owns the state + URL sync; each page renders the control), so
// stepping it on one page and navigating to the other must keep the same month
// rather than resetting to the current one.
test('the month picker persists across Dashboard and Monthly', async ({ page }) => {
  await page.goto('/')

  // The picker's compact heading is the shared month control on both pages.
  const heading = page.getByRole('heading', { name: /^[A-Z][a-z]+ \d{4}$/ })
  await expect(heading).toBeVisible()
  const initial = ((await heading.textContent())?.trim() ?? '').replace(/\s+/g, ' ')

  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(heading).not.toHaveText(initial)

  const stepped = ((await heading.textContent())?.trim() ?? '').replace(/\s+/g, ' ')
  // `getByRole` name matching is substring-based, and the Dashboard's chart
  // card title also contains a month/year ("... through September 2026"), so
  // match the picker heading exactly.
  const exactStepped = new RegExp(`^${stepped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
  const [, steppedYear, steppedMonth] =
    (await page.evaluate(() => window.location.search)).match(/year=(\d+)&month=(\d+)/) ?? []
  expect(steppedYear).toBeTruthy()
  expect(steppedMonth).toBeTruthy()

  // Navigate via the real nav link - a plain link with no query params.
  await page.getByRole('link', { name: 'Monthly', exact: true }).first().click()
  await expect(page).toHaveURL(/\/monthly/)
  await expect(page.getByRole('heading', { name: exactStepped })).toBeVisible()

  // And back, still the same month, now with the year/month params retained.
  await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click()
  await expect(page).toHaveURL(
    new RegExp(`localhost:\\d+/\\?year=${steppedYear}&month=${steppedMonth}$`)
  )
  await expect(page.getByRole('heading', { name: exactStepped })).toBeVisible()
})

test('a shared ?year=&month= link opens that month', async ({ page }) => {
  await page.goto('/monthly?year=2024&month=2')

  await expect(page.getByRole('heading', { name: /^February 2024$/ })).toBeVisible()
})

// The URL is the persistence layer (no localStorage): reloading a URL that
// carries a month restores that month rather than resetting to today.
test('a reload restores the month from the URL', async ({ page }) => {
  await page.goto('/?year=2025&month=7')
  await expect(page.getByRole('heading', { name: /^July 2025$/ })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { name: /^July 2025$/ })).toBeVisible()
  await expect(page).toHaveURL(/\/\?year=2025&month=7$/)
})
