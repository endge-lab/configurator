import { expect, test } from '@playwright/test'

test('memory and native IndexedDB satisfy adapter contracts', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/src/test/e2e/page-cache-contract.html')
  const checks = await page.evaluate(async () => (window as any).pageCacheContract)
  expect(checks).toHaveLength(14)
  expect(errors).toEqual([])
})
