import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  BACKEND_URL,
  openConfigurator,
  readClipboard,
  readDocument,
  screenshot,
  skipWithoutEnvironment,
  uniqueName,
  WORKSPACE,
} from './tenant-platform.helpers'

const TOKEN_PATTERN = /endge_pat_[\w-]+/

async function openAgentDialog(page: Page) {
  await page.getByRole('button', { name: 'Для агента' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Доступ для агента')).toBeVisible()
  return dialog
}

/**
 * Кнопка «Для агента»: выпуск токена чтения/записи, промпт с адресом, workspace и
 * ссылками llms, отзыв токена и флажок «Коммиты и релизы» только для Admin.
 */
test.describe('кнопка «Для агента»', () => {
  skipWithoutEnvironment()

  test('токен чтения: промпт, доступ к API, отзыв', async ({ page, request }, testInfo) => {
    const name = uniqueName(testInfo, 'W12b read')
    await openConfigurator(page)
    const dialog = await openAgentDialog(page)
    await dialog.getByLabel('Имя токена').fill(name)
    await expect(dialog.getByRole('radio', { name: 'Чтение' })).toHaveAttribute('aria-checked', 'true')
    // Коммиты недоступны без права записи.
    await expect(dialog.getByTestId('agent-access-commit').getByRole('checkbox')).toBeDisabled()
    await dialog.getByRole('button', { name: 'Создать токен' }).click()
    await expect(dialog.getByText('Токен создан')).toBeVisible()

    await dialog.getByRole('button', { name: 'Скопировать промпт' }).click()
    const prompt = await readClipboard(page)
    const token = prompt.match(TOKEN_PATTERN)?.[0]
    expect(token).toBeTruthy()
    expect(prompt).toContain(`Backend: ${BACKEND_URL}`)
    expect(prompt).toContain(`X-Endge-Workspace: ${WORKSPACE}`)
    expect(prompt).toContain('Права: только чтение')
    expect(prompt).toMatch(/llms\.txt/)
    // Предпросмотр промпта не раскрывает токен.
    await expect(dialog).not.toContainText(token!)
    await screenshot(page, '07-agent-token-read-created')

    const headers = { 'X-Endge-Workspace': WORKSPACE, 'Authorization': `Bearer ${token}` }
    const flight = await readDocument(request, 'queries', 'flight', token)
    const write = await request.patch(`${BACKEND_URL}/api/v1/types/InspectorField`, {
      headers: { ...headers, 'If-Match': `"${flight.revision}"` },
      data: { description: 'read token must not write' },
    })
    expect(write.status()).toBe(403)

    await dialog.getByRole('button', { name: 'Готово' }).click()
    const tokens = await openAgentDialog(page)
    await tokens.getByRole('tab', { name: 'Токены' }).click()
    const card = tokens.locator('li').filter({ hasText: name })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Отозвать' }).click()
    await card.getByRole('button', { name: 'Подтвердить' }).click()
    await expect(card).toContainText('отозван')
    await screenshot(page, '08-agent-token-revoked')

    const afterRevoke = await request.get(`${BACKEND_URL}/api/v1/queries/flight`, { headers })
    expect(afterRevoke.status()).toBe(401)
  })

  test('Admin: запись открывает флажок «Коммиты и релизы»', async ({ page }) => {
    await openConfigurator(page)
    const dialog = await openAgentDialog(page)
    await dialog.getByRole('radio', { name: 'Запись' }).click()
    const commit = dialog.getByTestId('agent-access-commit')
    await expect(commit.getByRole('checkbox')).toBeEnabled()
    await expect(commit).toContainText('Разрешает создавать коммиты')
  })

  test('не-Admin (Editor): флажок «Коммиты и релизы» неактивен', async ({ page, request }) => {
    const workspace = await (await request.get(`${BACKEND_URL}/api/v1/workspaces/${WORKSPACE}`, {
      headers: { 'X-Endge-Workspace': WORKSPACE },
    })).json() as { id: string, displayName: string }
    // Backend в dev-режиме всегда platform admin; роль Editor подставляется в ответ сессии.
    await page.route('**/auth/session', async (route) => {
      const response = await route.fetch()
      const session = await response.json()
      session.platformAdmin = false
      session.workspaces = [{ id: workspace.id, identity: WORKSPACE, displayName: workspace.displayName, active: true, role: 'editor' }]
      await route.fulfill({ response, json: session })
    })
    await openConfigurator(page)
    const dialog = await openAgentDialog(page)
    await dialog.getByRole('radio', { name: 'Запись' }).click()
    const commit = dialog.getByTestId('agent-access-commit')
    await expect(commit.getByRole('checkbox')).toBeDisabled()
    await expect(commit).toHaveAttribute('title', 'Коммиты токеном доступны только Admin workspace.')
    await expect(commit).toContainText('Коммиты токеном доступны только Admin workspace.')
    await screenshot(page, '09-agent-commit-disabled-editor')
  })
})
