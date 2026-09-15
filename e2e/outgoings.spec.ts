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

  await page.getByRole('button', { name: 'Edit' }).click()
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
