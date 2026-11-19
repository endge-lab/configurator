import { join } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { openConfigurator, openDocument, selectTenant } from './tenant-platform.helpers'

const artifactDirectory = process.env.ENDGE_E2E_MODULE_ARTIFACTS

test('publishes versions and renders the selected composition with its module', async ({ page }, testInfo) => {
  test.skip(!artifactDirectory, 'Requires an isolated workspace and ZIP fixtures for the module preview.')
  const directory = artifactDirectory!
  await openConfigurator(page)
  await page.getByRole('button', { name: 'Модули', exact: true }).click()
  const catalog = page.getByRole('dialog', { name: 'Модули' })

  const moduleName = 'Slot UI Preview'
  const existing = catalog.getByRole('button', { name: moduleName, exact: true })
  await expect(catalog.getByRole('button', { name: 'Создать', exact: true })).toBeEnabled()
  if (await existing.count()) {
    await existing.click()
  }
  else {
    await catalog.getByRole('button', { name: 'Создать', exact: true }).click()
    await catalog.getByLabel('Идентификатор').fill('slot-ui-preview')
    await catalog.getByLabel('Название').fill(moduleName)
    await catalog.getByLabel('ZIP сборки').setInputFiles(join(directory, 'slot-ui-preview-0.1.0-dev.1.zip'))
    await catalog.getByRole('button', { name: 'Загрузить', exact: true }).click()
  }
  await expect(catalog.getByText('0.1.0-dev.1', { exact: true })).toBeVisible()
  await catalog.getByRole('button', { name: 'Добавить версию' }).click()
  await catalog.getByLabel('ZIP сборки').setInputFiles(join(directory, 'slot-ui-preview-0.1.0-dev.2.zip'))
  await catalog.getByRole('button', { name: 'Загрузить', exact: true }).click()
  await expect(catalog.getByText('0.1.0-dev.2', { exact: true })).toBeVisible()
  await expect(catalog.getByRole('link', { name: 'Скачать ZIP' })).toHaveCount(2)
  await page.keyboard.press('Escape')

  async function launchPreview() {
    await openDocument(page, 'Композиции', 'Slot Preview (модуль)')
    await page.getByRole('button', { name: 'Запустить preview композиции' }).click()
    const standalone = page.getByRole('dialog').getByRole('button', { name: 'Запустить standalone' })
    if (await standalone.isVisible()) {
      await standalone.click()
    }
  }

  await launchPreview()
  const table = page.locator('[data-slot-repository-table]')
  await expect(table.first()).toBeVisible()
  await expect(table.locator('[data-density="compact"]').first()).toBeVisible()
  await expect(table.getByText('Согласование', { exact: true }).first()).toBeVisible()
  const firstRow = table.getByRole('row').filter({ hasText: 'SU 1191' }).first()
  await expect(firstRow).toBeVisible()
  await firstRow.click()
  await expect(firstRow).toHaveAttribute('aria-selected', 'true')
  await testInfo.attach('slot-tables', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByText('Графики Slot', { exact: true }).first().click()
  await expect(page.locator('.endge-timeline-chart canvas')).toHaveCount(3)
  await testInfo.attach('slot-timeline', { body: await page.screenshot(), contentType: 'image/png' })

  const domainWidget = page.locator('button:has(svg.lucide-folder-tree)').first()
  await domainWidget.click()
  await openDocument(page, 'Компоненты', 'Графики Slot')
  await page.getByRole('button', { name: 'Настройки Timeline' }).click()
  await page.getByRole('button', { name: 'Наземное время', exact: true }).click()
  const presets = page.getByLabel('Пресет Timeline').locator('option')
  await expect(presets).toContainText(['Наземное время', 'Загрузка ресурса', 'Предпросмотр загрузки'])

  await selectTenant(page, 'Default', 'Test')
  await launchPreview()
  await page.getByText('Slot обзор', { exact: true }).first().click()
  await expect(page.locator('[data-slot-repository-table="0.1.0-dev.2"]').first()).toBeVisible()
  await page.getByText('Slot согласование', { exact: true }).first().click()
  await expect(page.locator('[data-slot-repository-table="0.1.0-dev.1"]').first()).toBeVisible()
})
