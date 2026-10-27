import { expect, test } from '@playwright/test'
import { openConfigurator, screenshot, skipWithoutEnvironment } from './tenant-platform.helpers'

/**
 * Меню блока в `TemplatePreviewGrid` (режим страницы). Page и PageTemplate backend
 * не хранит (`UnsupportedCollections`), поэтому открыть Page_Editor на стенде нельзя:
 * компонент монтируется отдельным Vue-приложением внутри уже загруженного Configurator
 * с теми же модулями dev-сервера (reka, EndgeIDE) и проверяется в настоящем браузере.
 * Регрессия W12c: DropdownMenuTrigger внутри TooltipTrigger открывал меню вне экрана.
 */
// Монтирует TemplatePreviewGrid отдельным Vue-приложением с тем же экземпляром vue из optimized deps
// dev-сервера (иначе reka и компонент получили бы разные копии Vue).
const MOUNT_TEMPLATE_PREVIEW_GRID = `(async () => {
  const vueUrl = performance.getEntriesByType('resource')
    .map(entry => entry.name)
    .find(name => /\\/node_modules\\/\\.vite\\/deps\\/vue\\.js/.test(name))
  if (!vueUrl) {
    throw new Error('vue из optimized deps dev-сервера не найден')
  }
  const vue = await import(vueUrl)
  const grid = await import('/src/features/endge-ide/ui/components/TemplatePreviewGrid.vue')
  const host = document.createElement('div')
  host.id = 'w12c-template-preview-host'
  host.setAttribute('style', 'position:fixed;left:480px;top:320px;width:360px;z-index:40;background:var(--background)')
  document.body.appendChild(host)
  window.__w12cRemoved = []
  vue.createApp({
    render: () => vue.h(grid.default, {
      preview: { rows: [['main']], rowHeights: ['tall'] },
      pageMode: true,
      areaLabels: { main: 'Основная область' },
      pageAreas: [{
        slotId: 'main',
        blocks: [{ key: 'b1', entityIdentity: 'flight-inspector', entityId: 'c-1', displayName: 'Инспектор рейса' }],
      }],
      onRemoveBlock: ({ blockKey }) => window.__w12cRemoved.push(blockKey),
    }),
  }).mount(host)
})()`

test.describe('TemplatePreviewGrid: меню блока', () => {
  skipWithoutEnvironment()

  test('меню блока открывается рядом с кнопкой и пункт «Удалить» доступен', async ({ page }) => {
    await openConfigurator(page)

    // Скрипт строкой: tsconfig e2e без DOM lib; выполняется в странице Configurator.
    await page.evaluate(MOUNT_TEMPLATE_PREVIEW_GRID)

    const host = page.locator('#w12c-template-preview-host')
    await expect(host).toContainText('Основная область')
    const trigger = host.getByRole('button', { name: 'Инспектор рейса' })
    await expect(trigger).toBeVisible()
    // Открытое модальное меню скрывает остальное дерево от accessibility, поэтому координаты — до клика.
    const triggerBox = (await trigger.boundingBox())!
    await trigger.click()

    const item = page.getByRole('menuitem', { name: 'Удалить' })
    await expect(item).toBeVisible()
    const viewport = page.viewportSize()!
    const menuBox = (await page.getByRole('menu').boundingBox())!
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.y).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width)
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height)
    // Меню прикреплено к кнопке: не дальше 48px по вертикали и по левому краю.
    expect(Math.abs(menuBox.x - triggerBox.x)).toBeLessThan(48)
    expect(Math.abs(menuBox.y - (triggerBox.y + triggerBox.height))).toBeLessThan(48)
    await expect(page.getByRole('menu')).toContainText('flight-inspector')
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1')
    await screenshot(page, 'W12c-03-template-preview-menu')

    await item.click()
    expect(await page.evaluate('window.__w12cRemoved')).toEqual(['b1'])
  })
})
