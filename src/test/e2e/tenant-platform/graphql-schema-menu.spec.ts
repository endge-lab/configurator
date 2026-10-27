import { expect, test } from '@playwright/test'
import {
  FAKE_URL,
  openConfigurator,
  openDocument,
  readDocument,
  screenshot,
  skipWithoutEnvironment,
} from './tenant-platform.helpers'

/**
 * Меню «Схема GraphQL»: загрузка introspection с endpoint Query, маркеры схемы в
 * Monaco, автодополнение полей и те же проблемы в панели «Диагностика».
 * Правки Source не сохраняются — документ в backend не меняется.
 */
test.describe('меню «Схема GraphQL»', () => {
  skipWithoutEnvironment()

  test('загрузка схемы, автодополнение, маркеры и «Диагностика»', async ({ page, request }) => {
    const before = await readDocument(request, 'queries', 'flight')
    await openConfigurator(page)
    await openDocument(page, 'Обмен данными', 'Рейс (GraphQL)')

    const trigger = page.getByRole('button', { name: 'Схема GraphQL' })
    await trigger.click()
    const menu = page.getByRole('menu')
    await expect(menu).toContainText('Схема не загружена')
    // Регрессия W12b: меню открывалось вне экрана (якорь popper уходил в Tooltip).
    const box = await menu.boundingBox()
    expect(box && box.y >= 0 && box.x >= 0).toBe(true)
    await page.getByRole('menuitem', { name: 'Загрузить схему с endpoint' }).click()
    await expect(page.getByTestId('graphql-schema-loaded-marker')).toBeVisible()
    await expect(trigger).toHaveAttribute('title', `Схема: ${FAKE_URL}/graphql`)
    await trigger.click()
    await expect(page.getByRole('menu')).toContainText(/Типов: \d+/)
    await screenshot(page, '04-graphql-schema-menu-loaded')
    await page.keyboard.press('Escape')
    // Закрытие меню возвращает фокус на триггер после анимации — дождаться до клика в редактор.
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // Корректный документ с фрагментами в contextSwitch не даёт маркеров схемы.
    await expect(page.locator('.monaco-editor .squiggly-error')).toHaveCount(0)

    // Автодополнение полей Flight внутри selection set document.
    await page.locator('.monaco-editor .view-line').filter({ hasText: 'query Flight' }).click()
    await page.keyboard.press('End')
    for (let index = 0; index < ' } }`,'.length; index++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.type(' num')
    await page.keyboard.press('Control+Space')
    const suggest = page.locator('.monaco-editor .suggest-widget')
    await expect(suggest).toBeVisible()
    await expect(suggest).toContainText('number')
    await screenshot(page, '05-graphql-schema-autocomplete')

    // Неизвестное поле → маркер в редакторе и проблема в «Диагностика».
    // Курсор ставится заново: после первой правки фокус может уйти на панель инструментов.
    await page.locator('.monaco-editor .view-line').filter({ hasText: 'query Flight' }).click()
    await page.keyboard.press('End')
    for (let index = 0; index < ' } }`,'.length; index++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.type('berX')
    await expect(page.locator('.monaco-editor .view-line').filter({ hasText: 'numberX' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.monaco-editor .squiggly-error').first()).toBeVisible()
    await page.getByRole('button', { name: 'Диагностика' }).click()
    await expect(page.getByText('GraphQL schema: Cannot query field "numberX" on type "Flight". Did you mean "number"?').first()).toBeVisible()
    // Фрагменты из request.fragments не считаются неизвестными/неиспользуемыми (исправление W12b).
    await expect(page.getByText(/Unknown fragment|is never used/)).toHaveCount(0)
    await screenshot(page, '06-graphql-schema-diagnostics')

    const after = await readDocument(request, 'queries', 'flight')
    expect(after.revision).toBe(before.revision)
  })
})
