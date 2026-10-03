import { test, expect } from '@playwright/test'

// End-to-end cover for the Phase 3 unified outgoings flow: the list's rows
// link to a real detail page, editing happens through the shared form sheet,
// and lifecycle actions through the shared action menu, with the toast
// repeating the verb (see DESIGN.md → Copy rules).
test('bill list links to a detail page, where it can be edited, paused and restored', async ({
  page,
}) => {
  await page.goto('/bills')
  await expect(page.getByRole('heading', { name: 'Bills', level: 1 })).toBeVisible()

  await page.getByRole('link', { name: 'Health Insurance' }).click()
  await expect(page).toHaveURL(/\/bills\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Health Insurance', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Health Insurance' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByLabel('Amount').fill('215.50')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Bill updated')).toBeVisible()
  await expect(page.getByText('$215.50').first()).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Health Insurance' }).click()
  await page.getByRole('menuitem', { name: 'Pause' }).click()
  await expect(page.getByText('Bill paused')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Health Insurance' }).click()
  await page.getByRole('menuitem', { name: 'Resume' }).click()
  await expect(page.getByText('Bill resumed')).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Health Insurance' }).click()
  await expect(page.getByRole('menuitem', { name: 'Pause' })).toBeVisible()
})

// Every outgoings list carries the shared Sort control, and grouping is on by
// default where the adapter declares it and toggleable off (DESIGN.md → List
// sorting and grouping). Row links are the reliable read of the resulting order.
test('list sorting and grouping reorder and bucket the rows', async ({ page }) => {
  await page.goto('/bills')
  // Bills group by frequency, so the three monthly bills render together
  // first. Their default "Next due" order shifts as the calendar advances
  // (a bill whose day has passed rolls to next month), so assert the
  // date-stable "Name (A-Z)" order instead of hardcoding which bill happens
  // to be due first.
  const monthlyRows = page.locator('tbody a')
  await page.getByLabel('Sort').selectOption('name')
  await expect(monthlyRows.nth(0)).toHaveText('Childcare')
  await expect(monthlyRows.nth(1)).toHaveText('Health Insurance')
  await expect(monthlyRows.nth(2)).toHaveText('Streaming Service')

  await page.goto('/utilities')
  // Group headers are the only table cells that span the row.
  const groupHeaders = page.locator('table td[colspan]')
  await expect(groupHeaders.first()).toBeVisible()

  const grouping = page.getByRole('button', { name: 'Group by frequency' })
  await expect(grouping).toHaveAttribute('aria-pressed', 'true')
  await grouping.click()
  await expect(grouping).toHaveAttribute('aria-pressed', 'false')
  await expect(groupHeaders).toHaveCount(0)
})
