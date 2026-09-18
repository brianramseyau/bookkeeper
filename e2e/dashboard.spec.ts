import { test, expect } from '@playwright/test'

test('shows the dashboard with the two-zone snapshot and upcoming bills', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Dashboard · Bookkeeper/)
  await expect(page.getByRole('heading', { name: /welcome, jordan/i })).toBeVisible()

  // The two-zone snapshot ("Right now" stat row, "Over time" trend chart)
  // is the hero, replacing the old month strip.
  await expect(page.getByRole('heading', { name: 'Right now' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Over time' })).toBeVisible()
  await expect(page.getByText('Position', { exact: true })).toBeVisible()

  // demo:seed always has a recurring bill due in the future, so the upcoming
  // bills card lists at least one bill, each linking to its detail page.
  const upcomingBills = page.getByRole('heading', { name: 'Upcoming bills' }).locator('..')
  await expect(page.getByRole('heading', { name: 'Upcoming bills' })).toBeVisible()
  await expect(upcomingBills.locator('a[href^="/bills/"]').first()).toBeVisible()

  // demo:seed logs Groceries/Transport actuals every month, so the category
  // breakdown should never fall back to its empty state either.
  await expect(page.getByText('No spend recorded yet')).not.toBeVisible()
})
