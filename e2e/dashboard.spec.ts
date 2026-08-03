import { test, expect } from '@playwright/test'

test('shows the dashboard with month nav and summary cards', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Dashboard · Bookkeeper/)
  await expect(page.getByRole('heading', { name: /welcome, jordan/i })).toBeVisible()
  await expect(page.getByText('projected net')).toBeVisible()
  await expect(page.getByText('Actual net so far')).toBeVisible()

  // demo:seed always has a recurring bill due in the future, so the "next
  // bill due" card should show a real bill rather than the empty state.
  await expect(page.getByText('Next bill due')).toBeVisible()
  await expect(page.getByText('Nothing scheduled')).not.toBeVisible()

  // demo:seed logs Groceries/Transport actuals every month, so the category
  // breakdown should never fall back to its empty state either.
  await expect(page.getByText('No spend recorded yet')).not.toBeVisible()
})
