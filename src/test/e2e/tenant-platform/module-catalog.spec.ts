import { join } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { openConfigurator, openDocument, selectTenant } from './tenant-platform.helpers'

const artifactDirectory = process.env.ENDGE_E2E_MODULE_ARTIFACTS

test('publishes versions and renders the selected composition with its module', async ({ page }, testInfo) => {
  test.skip(!artifactDirectory, 'Requires an isolated workspace and ZIP fixtures for the module preview.')
  const directory = artifactDirectory!
  await openConfigurator(page)
  const folder = page.getByRole('button', { name: 'Модули', exact: true })
  if (await folder.getAttribute('aria-expanded') === 'false') {
    await folder.click()
  }
  const moduleName = 'Slot UI Preview'
  const moduleNode = page.getByRole('button', { name: moduleName, exact: true })
  await expect(folder).toHaveAttribute('aria-busy', 'false')
  if (!await moduleNode.isVisible()) {
    await folder.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Добавить модуль' }).click()
    const create = page.getByRole('dialog', { name: 'Добавить модуль' })
    await create.getByLabel('Идентификатор').fill('slot-ui-preview')
    await create.getByLabel('Название').fill(moduleName)
    await create.getByLabel('ZIP сборки').setInputFiles(join(directory, 'slot-ui-preview-0.1.0-dev.1.zip'))
    await create.getByRole('button', { name: 'Загрузить', exact: true }).click()
    await expect(create).toBeHidden()
  }
  await moduleNode.click()
  await expect(page.getByRole('tab', { name: moduleName, exact: true })).toBeVisible()
  const editor = page.getByRole('tabpanel', { name: moduleName })
  await expect(editor.getByText('0.1.0-dev.1', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Добавить версию' }).click()
  const publish = page.getByRole('dialog', { name: 'Добавить версию' })
  await publish.getByLabel('ZIP сборки').setInputFiles(join(directory, 'slot-ui-preview-0.1.0-dev.2.zip'))
  await publish.getByRole('button', { name: 'Загрузить', exact: true }).click()
  await expect(editor.getByText('0.1.0-dev.2', { exact: true })).toBeVisible()
  await expect(editor.getByRole('link', { name: 'Скачать ZIP' })).toHaveCount(2)

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
