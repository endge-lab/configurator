import { expect, test } from '@playwright/test'
import {
  BACKEND_URL,
  openConfigurator,
  openDocument,
  readClipboard,
  readDocument,
  screenshot,
  skipWithoutEnvironment,
  uniqueName,
  WORKSPACE,
} from './tenant-platform.helpers'

/**
 * «История» документа: изменение через REST с персональным токеном из UI помечается
 * бейджем агента с именем токена.
 */
test.describe('история ревизий с бейджем агента', () => {
  skipWithoutEnvironment()

  test('PATCH с PAT → ревизия с бейджем «агент: <имя токена>»', async ({ page, request }, testInfo) => {
    const name = uniqueName(testInfo, 'W12b write')
    await openConfigurator(page)
    await page.getByRole('button', { name: 'Для агента' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Имя токена').fill(name)
    await dialog.getByRole('radio', { name: 'Запись' }).click()
    await dialog.getByRole('button', { name: 'Создать токен' }).click()
    await expect(dialog.getByText('Токен создан')).toBeVisible()
    await dialog.getByRole('button', { name: 'Скопировать токен' }).click()
    const token = await readClipboard(page)
    expect(token).toMatch(/^endge_pat_/)
    await dialog.getByRole('button', { name: 'Готово' }).click()

    const current = await readDocument(request, 'types', 'InspectorField', token)
    const description = `Поле инспектора (правка агента ${Date.now().toString(36)})`
    const patch = await request.patch(`${BACKEND_URL}/api/v1/types/InspectorField`, {
      headers: { 'X-Endge-Workspace': WORKSPACE, 'Authorization': `Bearer ${token}`, 'If-Match': `"${current.revision}"` },
      data: { description },
    })
    expect(patch.status(), await patch.text()).toBe(200)

    await page.reload()
    await openConfigurator(page)
    await openDocument(page, 'Типы', 'Поле инспектора')
    await page.getByRole('button', { name: 'Основное', exact: true }).click()
    await page.getByText('История', { exact: true }).click()
    await expect(page.getByText('История ревизий')).toBeVisible()
    const marker = page.getByTestId('revision-agent-marker').first()
    await expect(marker).toBeVisible()
    await expect(marker).toContainText(`агент: ${name}`)
    await screenshot(page, '10-history-agent-badge')
  })
})
