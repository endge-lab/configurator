import type { APIRequestContext, Page, TestInfo } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

/**
 * Окружение UI e2e серии tenant-platform (W12b). Спеки работают против уже
 * запущенных процессов и пропускаются без ENDGE_TENANT_E2E=1:
 * - backend (AUTH_MODE=dev, временная БД) с импортированным workspace tenant-inspector;
 * - поддельный сервер рейсов (GraphQL + graphql-sse + REST);
 * - dev-сервер Configurator, указывающий на этот backend.
 * Подготовка — workspace/@endge/reports/2026-10-26-tenant-platform/W12b-ui.md.
 */
export const E2E_ENABLED = process.env.ENDGE_TENANT_E2E === '1'
export const BACKEND_URL = process.env.ENDGE_E2E_BACKEND_URL ?? 'http://localhost:18080'
export const FAKE_URL = process.env.ENDGE_E2E_FAKE_URL ?? 'http://127.0.0.1:18090'
export const WORKSPACE = process.env.ENDGE_E2E_WORKSPACE ?? 'tenant-inspector'
const SCREENSHOTS_DIR = process.env.ENDGE_E2E_SCREENSHOTS_DIR ?? 'test-results/tenant-platform-screenshots'

export function skipWithoutEnvironment(): void {
  test.skip(!E2E_ENABLED, 'ENDGE_TENANT_E2E=1 и запущенное окружение W12b не заданы')
}

export async function screenshot(page: Page, name: string): Promise<void> {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  await page.screenshot({ path: join(SCREENSHOTS_DIR, `${name}.png`) })
}

/** Открывает Configurator, выбирает backend «Основной» и ждёт дерево домена. */
export async function openConfigurator(page: Page): Promise<void> {
  await page.goto('/')
  const backendChoice = page.getByText('Выберите backend', { exact: true })
  const domainTree = page.getByText('Обмен данными', { exact: true })
  await expect(backendChoice.or(domainTree).first()).toBeVisible({ timeout: 60_000 })
  if (await backendChoice.isVisible()) {
    await page.getByText('Основной', { exact: true }).click()
  }
  await expect(domainTree).toBeVisible({ timeout: 60_000 })
}

/** Переключает workspace (по умолчанию development → mock) в live-данные. */
export async function enableLiveData(page: Page): Promise<void> {
  const toggle = page.locator('button[aria-pressed]').filter({ hasText: 'mock' })
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-pressed') === 'true') {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
}

export async function openDocument(page: Page, group: string, name: string): Promise<void> {
  const item = page.getByText(name, { exact: true }).first()
  if (!await item.isVisible()) {
    await page.getByText(group, { exact: true }).click()
  }
  await item.click()
}

export async function selectTenant(page: Page, current: string, next: string): Promise<void> {
  await page.getByRole('button', { name: current }).first().click()
  await page.getByRole('menuitem', { name: next }).click()
  await expect(page.getByRole('button', { name: next }).first()).toBeVisible()
  await expect(page.getByText('Не удалось переключить фасет')).toHaveCount(0)
}

export interface FakeRequestLogEntry {
  kind: 'graphql' | 'introspection' | 'rest' | 'sse'
  tenant: string
  variables?: Record<string, unknown>
  query?: string
  body?: Record<string, unknown>
}

export async function fakeServerLog(request: APIRequestContext): Promise<FakeRequestLogEntry[]> {
  const response = await request.get(`${FAKE_URL}/__log`)
  expect(response.ok()).toBe(true)
  return await response.json() as FakeRequestLogEntry[]
}

/** Документ workspace через REST backend (dev-режим: без cookie). */
export async function readDocument(
  request: APIRequestContext,
  collection: string,
  identity: string,
  token?: string,
): Promise<{ source?: string, revision: number, description?: string | null }> {
  const response = await request.get(`${BACKEND_URL}/api/v1/${collection}/${identity}`, {
    headers: {
      'X-Endge-Workspace': WORKSPACE,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  expect(response.status(), await response.text()).toBe(200)
  return await response.json()
}

export function uniqueName(testInfo: TestInfo, prefix: string): string {
  return `${prefix} ${testInfo.title.slice(0, 24)} ${Date.now().toString(36)}`
}

/** Текст буфера обмена страницы (контекст с разрешением clipboard-read). */
export async function readClipboard(page: Page): Promise<string> {
  return String(await page.evaluate('navigator.clipboard.readText()'))
}

/**
 * Ждёт закрытия toast (sonner). Toast поверх кнопки перехватывает клик, а курсор Playwright,
 * зависший над ним при повторах клика, ставит таймер toast на паузу — тест висит до таймаута.
 */
export async function waitForToastsToClose(page: Page): Promise<void> {
  await page.mouse.move(1, 1)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}
