import { expect, test } from '@playwright/test'
import {
  openConfigurator,
  openDocument,
  readDocument,
  screenshot,
  skipWithoutEnvironment,
} from './tenant-platform.helpers'

const INHERITED_FROM_FLIGHT = ['id', 'number', 'status', 'departure', 'gate', 'crew']

/**
 * Редактор Type с `extends` (W12b, W12c): визуальный режим показывает базовый тип и
 * унаследованные поля только для чтения с пометкой, собственные поля редактируются, правка
 * в визуальном режиме не теряет `extends: type('Flight')` и не переносит унаследованные поля
 * в Source. Документ не сохраняется.
 */
test.describe('редактор Type с extends', () => {
  skipWithoutEnvironment()

  test('выбор типа поля не сжимается и показывает значение', async ({ page }) => {
    await openConfigurator(page)
    await openDocument(page, 'Типы', 'Рейс')
    const editor = page.locator('.type-visual-editor').first()
    await expect(editor).toContainText('departure')
    const selects = editor.locator('.type-visual-editor__type-select')
    await expect(selects.first()).toBeVisible()
    const count = await selects.count()
    expect(count).toBeGreaterThanOrEqual(5)
    for (let index = 0; index < count; index += 1) {
      const select = selects.nth(index)
      const box = (await select.boundingBox())!
      expect(box.width, `ширина выбора типа #${index}`).toBeGreaterThanOrEqual(100)
      // Значение не обрезано: подпись помещается в триггер целиком.
      const label = select.locator('span.truncate')
      expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    }
    await expect(selects.first()).toHaveText('String')
    await screenshot(page, 'W12c-01-type-select-width')
  })

  test('визуальный режим FlightKzn: база, унаследованные поля и сохранение extends', async ({ page, request }) => {
    const before = await readDocument(request, 'types', 'FlightKzn')
    expect(before.source).toContain('extends: type(\'Flight\')')

    await openConfigurator(page)
    await openDocument(page, 'Типы', 'Рейс КЗН')
    const editor = page.locator('.type-visual-editor').first()
    await expect(editor.getByTestId('type-visual-extends-base')).toHaveText('Flight')
    await expect(editor.getByTestId('type-visual-extends')).toContainText(`унаследовано полей: ${INHERITED_FROM_FLIGHT.length}`)

    const inheritedRows = editor.locator('.type-visual-editor__tree-row[data-inherited-from="Flight"]')
    await expect(inheritedRows).toHaveCount(INHERITED_FROM_FLIGHT.length)
    const groups = editor.getByTestId('type-visual-field-group')
    await expect(groups).toHaveCount(2)
    await expect(groups.nth(0)).toContainText('Унаследовано от')
    await expect(groups.nth(0).getByRole('button', { name: 'Flight' })).toBeVisible()
    await expect(groups.nth(1)).toHaveText('Собственные поля')
    for (const [index, key] of INHERITED_FROM_FLIGHT.entries()) {
      const row = inheritedRows.nth(index)
      await expect(row.locator('.type-visual-editor__resolved-name')).toHaveText(key)
      await expect(row.getByTestId('type-visual-inherited-marker')).toHaveAttribute('aria-label', 'унаследовано от Flight')
      // Только чтение: нет поля имени, выбора типа и действий изменения.
      await expect(row.locator('input')).toHaveCount(0)
      await expect(row.locator('.type-visual-editor__type-select')).toHaveCount(0)
      await expect(row.getByRole('button', { name: 'Delete field' })).toHaveCount(0)
    }
    // Собственные поля идут после унаследованных и редактируются.
    const ownRows = editor.locator('.type-visual-editor__tree-row:not([data-inherited-from])')
      .filter({ has: page.locator('.type-visual-editor__name-input') })
    await expect(ownRows).toHaveCount(2)
    for (const [index, key] of ['stand', 'handlingAgent'].entries()) {
      await expect(ownRows.nth(index).locator('.type-visual-editor__name-input')).toHaveValue(key)
      await expect(ownRows.nth(index).locator('.type-visual-editor__type-select')).toHaveText('String')
    }
    // Предпросмотр и пример включают унаследованные поля.
    const docs = editor.locator('.type-visual-editor__property-docs')
    await expect(docs).toContainText('number')
    await expect(docs).toContainText('унаследовано от Flight')
    await expect(editor.locator('.type-visual-editor__example-card pre')).toContainText('"departure"')
    await expect(editor.locator('.type-visual-editor__example-card pre')).toContainText('"stand"')
    await screenshot(page, 'W12c-02-type-extends-visual')

    // Правка собственного поля: имя stand → standCode.
    const standInput = ownRows.nth(0).locator('.type-visual-editor__name-input')
    await standInput.fill('standCode')
    await standInput.blur()
    await expect(ownRows.nth(0).locator('.type-visual-editor__name-input')).toHaveValue('standCode')
    await page.getByRole('button', { name: 'Add schema item' }).click()
    await expect(ownRows).toHaveCount(3)
    await expect(ownRows.nth(2).locator('.type-visual-editor__name-input')).toHaveValue('field')
    await expect(inheritedRows).toHaveCount(INHERITED_FROM_FLIGHT.length)

    await page.getByRole('button', { name: 'Source', exact: true }).click()
    const source = page.locator('.monaco-editor').first()
    await expect(source).toContainText('extends: type(\'Flight\')')
    await expect(source).toContainText('standCode: field(String)')
    await expect(source).toContainText('handlingAgent')
    await expect(source).toContainText('field: field(String)')
    // Унаследованные поля в Source не попадают.
    await expect(source).not.toContainText('departure')
    await expect(source).not.toContainText('number: field')
    await screenshot(page, 'W12c-04-type-extends-source-after-visual-edit')

    const after = await readDocument(request, 'types', 'FlightKzn')
    expect(after.revision).toBe(before.revision)
  })
})
