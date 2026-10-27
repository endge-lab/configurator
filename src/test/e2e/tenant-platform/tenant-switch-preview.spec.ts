import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  enableLiveData,
  fakeServerLog,
  openConfigurator,
  openDocument,
  screenshot,
  selectTenant,
  skipWithoutEnvironment,
} from './tenant-platform.helpers'

async function runInspectorPreview(page: Page) {
  await openDocument(page, 'Композиции', 'Инспектор рейса')
  await page.getByRole('button', { name: 'Запустить preview композиции' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Запустить standalone' }).click()
}

/**
 * Выбор тенанта в строке состояния: АФЛ и КЗН дают разные фрагменты GraphQL,
 * Configuration фасета (секции инспектора) и ветку enabledWhen в превью композиции.
 */
test.describe('переключение тенанта', () => {
  skipWithoutEnvironment()

  test('АФЛ: инспектор с выходом и КВС, без блока КЗН', async ({ page, request }) => {
    await openConfigurator(page)
    await enableLiveData(page)
    await runInspectorPreview(page)
    await expect(page.getByText('Инспектор рейса SU1402')).toBeVisible()
    await expect(page.getByText('B12')).toBeVisible()
    await expect(page.getByText('Иванов')).toBeVisible()
    await expect(page.getByText('Наземное обслуживание')).toHaveCount(0)
    await expect(page.getByText('Обслуживание КЗН')).toHaveCount(0)
    await screenshot(page, '11-tenant-afl-preview')

    const last = (await fakeServerLog(request)).filter(entry => entry.kind === 'graphql').at(-1)
    expect(last?.tenant).toBe('afl')
    expect(last?.query).toContain('gate')
  })

  test('КЗН: смена фасета без ошибки, другой инспектор и блок обслуживания', async ({ page, request }) => {
    await openConfigurator(page)
    await enableLiveData(page)
    // Регрессия W12b: смена фасета падала «Cannot redefine phases» (EndgeVue_Module.start).
    await selectTenant(page, 'АФЛ', 'КЗН')
    await runInspectorPreview(page)
    await expect(page.getByText('Инспектор КЗН SU1402')).toBeVisible()
    await expect(page.getByText('Наземное обслуживание')).toBeVisible()
    await expect(page.getByText('Казань Хэндлинг').first()).toBeVisible()
    await expect(page.getByText('Гарипов')).toBeVisible()
    await expect(page.getByText('Обслуживание КЗН')).toBeVisible()
    await expect(page.getByText('B12')).toHaveCount(0)
    await screenshot(page, '12-tenant-kzn-preview')

    const last = (await fakeServerLog(request)).filter(entry => entry.kind === 'graphql').at(-1)
    expect(last?.tenant).toBe('kzn')
    expect(last?.query).toContain('handlingAgent')
    expect(last?.query).not.toContain('gate')
  })
})
