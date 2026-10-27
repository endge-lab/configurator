import { expect, test } from '@playwright/test'
import {
  enableLiveData,
  fakeServerLog,
  openConfigurator,
  openDocument,
  screenshot,
  skipWithoutEnvironment,
  waitForToastsToClose,
} from './tenant-platform.helpers'

/**
 * Панель «Запуск Query»: REST и GraphQL против поддельного сервера, ошибки GraphQL,
 * маскирование тела, «Запустить» одним кликом и режим mock.
 */
test.describe('панель запуска Query', () => {
  skipWithoutEnvironment()

  test.beforeEach(async ({ page }) => {
    await openConfigurator(page)
  })

  test('в режиме mock HTTP-запрос не отправляется', async ({ page }) => {
    await openDocument(page, 'Обмен данными', 'Рейс (GraphQL)')
    await page.getByRole('button', { name: 'Панель запуска Query' }).click()
    const panel = page.locator('.query-run-panel')
    await panel.locator('input').first().fill('SU1402')
    await panel.getByRole('button', { name: 'Выполнить' }).click()
    await expect(panel.getByText('Успешно')).toBeVisible()
    await expect(panel.getByText(/HTTP-запрос не отправлялся/).first()).toBeVisible()
  })

  test('REST: «Запустить» одним кликом и маскирование секрета в теле', async ({ page, request }) => {
    await enableLiveData(page)
    await openDocument(page, 'Обмен данными', 'Рейс (REST)')
    await waitForToastsToClose(page)
    await page.getByTestId('query-quick-run').click()
    const panel = page.locator('.query-run-panel')
    await expect(panel.getByText('Успешно')).toBeVisible()
    await expect(panel.getByText('HTTP 200')).toBeVisible()
    await panel.getByRole('tab', { name: 'Запрос' }).click()
    await expect(panel.getByText('Скрыто: clientSecret')).toBeVisible()
    await expect(panel).toContainText('"clientSecret": "***"')
    await expect(panel).not.toContainText('demo-client-secret')
    await expect(panel).toContainText('X-Tenant')
    await screenshot(page, '01-query-run-rest-masked')

    // Сервер получил настоящее значение: маскируется только отображение.
    const rest = (await fakeServerLog(request)).filter(entry => entry.kind === 'rest').at(-1)
    expect(rest).toMatchObject({ tenant: 'afl', body: { id: 'SU1402', clientSecret: 'demo-client-secret' } })
  })

  test('GraphQL: успешный ответ с фрагментом тенанта АФЛ', async ({ page, request }) => {
    await enableLiveData(page)
    await openDocument(page, 'Обмен данными', 'Рейс (GraphQL)')
    // Обязательный prop без default — кнопки «Запустить» нет.
    await expect(page.getByTestId('query-quick-run')).toHaveCount(0)
    await page.getByRole('button', { name: 'Панель запуска Query' }).click()
    const panel = page.locator('.query-run-panel')
    await panel.locator('input').first().fill('SU1402')
    await expect(panel).toContainText('"id": "SU1402"')
    await panel.getByRole('button', { name: 'Выполнить' }).click()
    await expect(panel.getByText('Успешно')).toBeVisible()
    await expect(panel.getByText('HTTP 200')).toBeVisible()
    await expect(panel.getByRole('tab', { name: 'Ошибки GraphQL (0)' })).toBeVisible()
    await panel.getByRole('tab', { name: 'Запрос' }).click()
    await expect(panel).toContainText('fragment FlightFields on Flight')
    await expect(panel).toContainText('gate')
    await screenshot(page, '02-query-run-graphql-success')

    const graphql = (await fakeServerLog(request)).filter(entry => entry.kind === 'graphql').at(-1)
    expect(graphql?.tenant).toBe('afl')
    expect(graphql?.variables).toEqual({ id: 'SU1402' })
    expect(graphql?.query).toContain('gate')
    expect(graphql?.query).not.toContain('handlingAgent')
  })

  test('GraphQL: ошибки ответа показаны на вкладке «Ошибки GraphQL»', async ({ page }) => {
    await enableLiveData(page)
    await openDocument(page, 'Обмен данными', 'Рейс (GraphQL)')
    await page.getByRole('button', { name: 'Панель запуска Query' }).click()
    const panel = page.locator('.query-run-panel')
    await panel.locator('input').first().fill('ERR')
    await panel.getByRole('button', { name: 'Выполнить' }).click()
    await expect(panel.getByText('Ошибка', { exact: true })).toBeVisible()
    await expect(panel.getByRole('alert')).toContainText('Ошибка GraphQL')
    await expect(panel.getByRole('tab', { name: 'Ошибки GraphQL (1)' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel).toContainText('Flight ERR is not available')
    await expect(panel).toContainText('path: flight')
    await screenshot(page, '03-query-run-graphql-errors')
  })
})
