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
  const initial = (await heading.textContent())?.trim() ?? ''

  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(heading).not.toHaveText(initial)

  const stepped = (await heading.textContent())?.trim() ?? ''
  await expect(page).toHaveURL(/[?&]month=\d+/)

  // Navigate via the real nav link - a plain link with no query params.
  await page.getByRole('link', { name: 'Monthly', exact: true }).first().click()
  await expect(page).toHaveURL(/\/monthly/)

  await expect(page.getByRole('heading', { name: stepped })).toBeVisible()

  // And back, still the same month (the Dashboard URL now carries the step).
  await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click()
  await expect(page).toHaveURL(/localhost:\d+\/(\?|$)/)
  await expect(page.getByRole('heading', { name: stepped })).toBeVisible()
})

test('a shared ?year=&month= link opens that month', async ({ page }) => {
  await page.goto('/monthly?year=2024&month=2')

  await expect(page.getByRole('heading', { name: 'February 2024' })).toBeVisible()
})
