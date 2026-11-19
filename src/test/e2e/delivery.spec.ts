import process from 'node:process'
import { expect, test } from '@playwright/test'

test('runs the packed tenant renderer without a module catalog', async ({ page }) => {
  const filename = process.env.ENDGE_DELIVERY_TEST_FILE
  test.skip(!filename, 'Requires the Gzip produced by the Core delivery integration test')
  const catalogRequests: string[] = []
  await page.route('**/api/v1/modules/**', (route) => {
    catalogRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/src/test/e2e/delivery.html')
  await page.getByLabel('Delivery bundle').setInputFiles(filename!)
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  const renderer = page.getByText('SELECTED_MODULE_PAYLOAD', { exact: true })
  await expect(renderer).toBeVisible()
  await expect(renderer).toHaveCSS('color', 'rgb(255, 0, 0)')
  expect(catalogRequests).toEqual([])
})
