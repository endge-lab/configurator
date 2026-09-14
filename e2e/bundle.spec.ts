import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

function collectErrors(page: Page, errors: string[]): void {
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
}

async function ready(page: Page, role: string): Promise<void> {
  await page.goto(`/e2e/fixture.html?role=${role}`)
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
}
async function openFile(page: Page, filename: string): Promise<void> {
  await page
    .getByRole('button', { name: 'Приложение для удалённой отладки' })
    .click()
  await page.getByRole('menuitem', { name: 'Загрузить Bundle…' }).click()
  await page.getByTestId('bundle-file-input').setInputFiles(filename)
  await expect(page.getByTestId('bundle-summary')).toBeVisible()
  await page.getByRole('button', { name: 'Открыть инспекцию' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

for (const format of ['gzip', 'json'] as const) {
  for (const ast of [false, true]) {
    test(`build → ${format} → debugger, AST=${ast}`, async ({
      page,
      context,
    }, info) => {
      const errors: string[] = []
      collectErrors(page, errors)
      await ready(page, 'build')
      await page.getByLabel('Формат файла').selectOption(format)
      if (ast) {
        await page.getByLabel('Включить AST').check()
      }
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Собрать и скачать' }).click()
      await expect(page.getByTestId('build-result')).toBeVisible()
      await page.getByRole('button', { name: 'Скачать Bundle', exact: true }).click()
      const download = await downloadPromise
      const filename = info.outputPath(download.suggestedFilename())
      await download.saveAs(filename)
      const bytes = await readFile(filename)
      if (format === 'gzip') {
        expect([...bytes.subarray(0, 2)]).toEqual([31, 139])
      }
      else {
        expect(JSON.parse(bytes.toString()).format).toBe('endge-bundle')
      }
      const debuggerPage = await context.newPage()
      collectErrors(debuggerPage, errors)
      await ready(debuggerPage, 'debugger')
      await openFile(debuggerPage, filename)
      await debuggerPage.getByRole('button', { name: 'Развернуть все блоки' }).click()
      await debuggerPage
        .getByRole('treeitem', { name: /Inspection Table/ })
        .click()
      await expect(
        debuggerPage.getByRole('tab', { name: 'Артефакт', exact: true }),
      ).toBeVisible()
      await debuggerPage
        .getByRole('tab', { name: 'Текст', exact: true })
        .click()
      if (ast) {
        await expect(debuggerPage.getByLabel('Восстановлено из AST, только чтение')).toBeVisible()
        await expect(debuggerPage.getByText('Восстановлено из AST.', { exact: false })).toHaveCount(0)
      }
      else {
        await expect(debuggerPage.getByText('Source недоступен в этом Bundle:', { exact: false })).toBeVisible()
      }
      await debuggerPage
        .getByRole('tab', { name: 'Артефакт', exact: true })
        .click()
      await expect(
        debuggerPage.getByRole('button', { name: 'Скачать артефакт JSON' }),
      ).toBeVisible()
      expect(
        await debuggerPage.evaluate(
          () =>
            (window as any).inspectionFixture.Endge.runtime.getRuntimeHosts().length,
        ),
      ).toBe(0)
      expect(errors).toEqual([])
    })
  }
}

test('независимый debugger: consent → host Action Bundle → шаги → snapshot → файл', async ({
  page,
  context,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const client = await context.newPage()
  collectErrors(client, errors)
  await ready(client, 'client')
  await ready(page, 'debugger')
  await page
    .getByRole('button', { name: 'Приложение для удалённой отладки' })
    .click()
  await page
    .getByRole('menuitem', { name: /Runtime inspection fixture/ })
    .click()
  await expect
    .poll(() =>
      client.evaluate(() =>
        Boolean(
          (window as any).inspectionFixture.Endge.bridge.debug.pendingConsent,
        ),
      ),
    )
    .toBe(true)
  await client.getByRole('button', { name: 'Разрешить отладку' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /Онлайн/ }),
  ).toBeVisible()
  expect(await page.evaluate(() => (window as any).inspectionFixture.Endge.program.exportBundle().requirements.hostActions))
    .toEqual(expect.arrayContaining([expect.objectContaining({ identity: 'built-in-test-alert' })]))
  // Open through the registered layout owner, then all timeline interactions use the real widget.
  await page.evaluate(async () => {
    const { showWidget }
      = await import('/src/components/layouts/grid/layout.ts')
    showWidget('inspection-history')
  })
  await expect(page.getByTestId('inspection-history')).toBeVisible()
  await expect(page.getByLabel('Не передавать данные')).toBeChecked()
  await page.getByLabel('Не передавать данные').click()
  await expect(page.getByLabel('Не передавать данные')).not.toBeChecked()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).inspectionFixture.Endge.inspection.receivedSequence,
      ),
    )
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'К последнему', exact: true }).click()
  const applied = await page.evaluate(
    () => (window as any).inspectionFixture.Endge.inspection.appliedSequence,
  )
  await client.getByRole('button', { name: 'Изменить данные' }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).inspectionFixture.Endge.inspection.receivedSequence,
      ),
    )
    .toBeGreaterThan(applied)
  expect(
    await page.evaluate(
      () => (window as any).inspectionFixture.Endge.inspection.appliedSequence,
    ),
  ).toBe(applied)
  await page.getByRole('button', { name: 'Шаг вперёд', exact: true }).click()
  await page.getByRole('button', { name: 'К последнему', exact: true }).click()
  await page.getByRole('button', { name: 'Запросить полный снимок' }).click()
  await page.getByRole('button', { name: 'К последнему', exact: true }).click()
  const expected = await page.evaluate(
    () => (window as any).inspectionFixture.Endge.runtime.inspection.data,
  )
  const downloadPromise = page.waitForEvent('download')
  await page.evaluate(() => (window as any).inspectionFixture.Configurator.remoteDebugger.downloadRecording('gzip'))
  const download = await downloadPromise
  const filename = info.outputPath(download.suggestedFilename())
  await download.saveAs(filename)
  const filePage = await context.newPage()
  collectErrors(filePage, errors)
  await ready(filePage, 'debugger')
  await openFile(filePage, filename)
  await filePage.evaluate(() => {
    const inspection = (window as any).inspectionFixture.Endge.inspection
    inspection.seek(inspection.receivedSequence)
  })
  expect(
    await filePage.evaluate(
      () => (window as any).inspectionFixture.Endge.runtime.inspection.data,
    ),
  ).toEqual(expected)
  await page.getByLabel('Не передавать данные').click()
  await expect(page.getByLabel('Не передавать данные')).toBeChecked()
  await info.attach('inspection-history', { body: await page.screenshot({ path: info.outputPath('inspection-history.png') }), contentType: 'image/png' })
  await client.getByRole('button', { name: 'Отключить' }).click()
  expect(errors).toEqual([])
})

test('large artifact, chunk append and failed import preserve the session', async ({
  page,
}, info) => {
  const errors: string[] = []
  collectErrors(page, errors)
  await ready(page, 'debugger')
  const value = JSON.parse(
    await readFile(
      '../../packages/@endge-core/src/test/fixtures/bundles/program.json',
      'utf8',
    ),
  )
  const artifact = Object.values(value.bundle.artifacts).find(
    (item: any) => item.ref.entityType === 'component-sfc',
  ) as any
  artifact.metadata.self.large = Array.from({ length: 20000 }, (_, id) => ({
    id,
    value: `Artifact row ${id}`,
  }))
  const initial = {
    sequence: 0,
    at: 0,
    kind: 'snapshot',
    scope: 'inspection',
    revision: 0,
    reason: 'initial',
    value: {
      context: value.bundle.context,
      runtime: {
        version: 1,
        runtime: {
          generatedAt: 0,
          hosts: [],
          scopes: [],
          total: 0,
          byStatus: {},
          deletedTotal: 0,
          deletedHosts: [],
        },
      },
      data: { count: 0 },
      dataAvailable: true,
    },
  }
  const updates = [1, 2, 3].map(sequence => ({
    sequence,
    at: sequence,
    kind: 'delta',
    baseRevision: sequence - 1,
    revision: sequence,
    changes: [{ op: 'set', path: ['data', 'count'], value: sequence }],
  }))
  value.bundle.catalog.folders = {
    workspace: { id: 'workspace', identity: 'workspace', displayName: 'Workspace', parentId: null, scope: 'workspace', entityType: null, position: 0 },
    nested: { id: 'nested', identity: 'nested', displayName: 'Nested', parentId: 'workspace', scope: 'workspace', entityType: null, position: 1 },
    components: { id: 'components', identity: 'components', displayName: 'Components', parentId: null, scope: 'collection', entityType: 'components', position: 2 },
  }
  value.bundle.catalog.documents['component-sfc:2'].workspaceFolderId = 'nested'
  value.bundle.catalog.documents['component-sfc:2'].folderId = 'components'
  value.inspection = {
    version: 1,
    programId: value.bundle.programId,
    runId: 'browser-run',
    recordingId: 'browser-recording',
    chunks: [
      { firstSequence: 0, lastSequence: 1, records: [initial, updates[0]] },
    ],
  }
  const file = info.outputPath('program-with-history.json')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(file, JSON.stringify(value))
  await page.evaluate(() => {
    const fixture = (window as any).inspectionFixture
    fixture.gaps = []
    fixture.lastTick = performance.now()
    fixture.timer = setInterval(() => {
      const now = performance.now()
      fixture.gaps.push(now - fixture.lastTick)
      fixture.lastTick = now
    }, 16)
  })
  await openFile(page, file)
  const responsiveness = await page.evaluate(() => {
    const fixture = (window as any).inspectionFixture
    clearInterval(fixture.timer)
    return {
      ticks: fixture.gaps.length,
      maximumGapMs: Math.max(...fixture.gaps),
    }
  })
  expect(responsiveness.ticks).toBeGreaterThan(0)
  await info.attach('worker-import-responsiveness', {
    body: JSON.stringify(responsiveness),
    contentType: 'application/json',
  })
  await page.getByRole('button', { name: 'Показать структуру «Рабочее пространство»', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Модель', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Workspace', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Nested', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Bundle 1', exact: true }).click()
  await page.getByRole('tab', { name: 'Артефакт', exact: true }).click()
  expect(await page.locator('body *').count()).toBeLessThan(3000)
  const before = await page.evaluate(
    () => (window as any).inspectionFixture.Endge.program.programId,
  )
  await page
    .getByRole('button', { name: 'Приложение для удалённой отладки' })
    .click()
  await page.getByRole('menuitem', { name: 'Загрузить Bundle…' }).click()
  await page
    .getByTestId('bundle-file-input')
    .setInputFiles({
      name: 'looks-valid.endge-bundle.gz',
      mimeType: 'application/gzip',
      buffer: Buffer.from('{broken'),
    })
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(
    await page.evaluate(
      () => (window as any).inspectionFixture.Endge.program.programId,
    ),
  ).toBe(before)
  const tail = {
    format: 'endge-bundle',
    version: 1,
    inspection: {
      ...value.inspection,
      chunks: [
        { firstSequence: 2, lastSequence: 3, records: updates.slice(1) },
      ],
    },
  }
  await page
    .getByRole('button', { name: 'Приложение для удалённой отладки' })
    .click()
  await page.getByRole('menuitem', { name: 'Загрузить Bundle…' }).click()
  await page
    .getByTestId('bundle-file-input')
    .setInputFiles({
      name: 'chunks.txt',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(JSON.stringify(tail)),
    })
  await expect(page.getByTestId('bundle-summary')).toBeVisible()
  await page.getByRole('button', { name: 'Добавить историю' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => (window as any).inspectionFixture.Endge.inspection.receivedSequence,
    ),
  ).toBe(3)
  expect(
    await page.evaluate(
      () => (window as any).inspectionFixture.Endge.inspection.appliedSequence,
    ),
  ).toBe(0)
  await page.evaluate(() =>
    (window as any).inspectionFixture.Endge.inspection.seek(3),
  )
  expect(
    await page.evaluate(
      () => (window as any).inspectionFixture.Endge.runtime.inspection.data,
    ),
  ).toEqual({ count: 3 })
  expect(errors).toEqual([])
})

test('large history keeps the panel bounded and seeks through checkpoints', async ({ page }, info) => {
  const errors: string[] = []
  collectErrors(page, errors)
  await ready(page, 'debugger')
  const value = JSON.parse(await readFile('../../packages/@endge-core/src/test/fixtures/bundles/program.json', 'utf8'))
  const snapshotValue = {
    context: value.bundle.context,
    runtime: { version: 1, runtime: { generatedAt: 0, hosts: [], scopes: [], total: 0, byStatus: {}, deletedTotal: 0, deletedHosts: [] } },
    data: { count: 0 },
    dataAvailable: true,
  }
  const records = Array.from({ length: 10001 }, (_, sequence) => sequence % 500 === 0
    ? { sequence, at: sequence, kind: 'snapshot', scope: 'inspection', revision: sequence, reason: sequence === 0 ? 'initial' : 'checkpoint', value: { ...snapshotValue, data: { count: sequence } } }
    : { sequence, at: sequence, kind: 'delta', baseRevision: sequence - 1, revision: sequence, changes: [{ op: 'set', path: ['data', 'count'], value: sequence }] })
  value.inspection = { version: 1, programId: value.bundle.programId, runId: 'large-run', recordingId: 'large-recording', chunks: [{ firstSequence: 0, lastSequence: 10000, records }] }
  const filename = info.outputPath('large-history.json')
  const { writeFile } = await import('node:fs/promises')
  await writeFile(filename, JSON.stringify(value))
  const started = Date.now()
  await openFile(page, filename)
  await page.evaluate(async () => {
    const { showWidget } = await import('/src/components/layouts/grid/layout.ts')
    showWidget('inspection-history')
  })
  const panel = page.getByTestId('inspection-history')
  await expect(panel).toBeVisible()
  const list = panel.getByRole('list', { name: 'Записи инспекции' })
  await expect(list.getByRole('button')).toHaveCount(201)
  const listBounds = await list.boundingBox()
  const panelBounds = await panel.boundingBox()
  await expect(panel.getByRole('button', { name: 'Скачать программу и историю' })).toHaveCount(0)
  await expect(panel.getByLabel('Начало диапазона')).toHaveCount(0)
  expect(listBounds!.height).toBeGreaterThan(100)
  expect(listBounds!.y + listBounds!.height).toBeLessThanOrEqual(panelBounds!.y + panelBounds!.height)
  await expect(panel.getByLabel('Не передавать данные')).toHaveCount(0)
  await panel.getByLabel('Тип записи').selectOption('snapshot')
  await expect(list.getByRole('button')).toHaveCount(21)
  await page.getByTestId('inspection-controls').getByRole('button', { name: 'К последнему', exact: true }).click()
  expect(await page.evaluate(() => (window as any).inspectionFixture.Endge.runtime.inspection.data.count)).toBe(10000)
  await page.getByTestId('inspection-controls').getByRole('button', { name: 'Назад', exact: true }).click()
  expect(await page.evaluate(() => (window as any).inspectionFixture.Endge.runtime.inspection.data.count)).toBe(9999)
  await info.attach('large-history-ui', { body: JSON.stringify({ records: records.length, totalImportAndInteractionsMs: Date.now() - started, listHeight: listBounds!.height }), contentType: 'application/json' })
  await info.attach('large-history-panel', { body: await page.screenshot({ path: info.outputPath('large-history-panel.png') }), contentType: 'image/png' })
  expect(errors).toEqual([])
})

test('drop Bundle anywhere or onto the dialog without navigating away', async ({ page }) => {
  const errors: string[] = []
  collectErrors(page, errors)
  await ready(page, 'debugger')
  const bytes = [...await readFile('../../packages/@endge-core/src/test/fixtures/bundles/program.gz')]
  const drop = async (target: string, data: number[], name: string) => {
    const transfer = await page.evaluateHandle(({ data, name }) => {
      const value = new DataTransfer()
      value.items.add(new File([new Uint8Array(data)], name, { type: 'application/octet-stream' }))
      return value
    }, { data, name })
    await page.locator(target).dispatchEvent('dragover', { dataTransfer: transfer })
    await page.locator(target).dispatchEvent('drop', { dataTransfer: transfer })
    await transfer.dispose()
  }
  const url = page.url()
  await drop('body', bytes, 'content-detected.txt')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Развернуть все блоки' }).click()
  await expect(page.getByRole('treeitem', { name: 'Bundle 1', exact: true })).toBeVisible()
  const programId = await page.evaluate(() => (window as any).inspectionFixture.Endge.program.programId)
  await page.getByRole('button', { name: 'Приложение для удалённой отладки' }).click()
  await page.getByRole('menuitem', { name: 'Загрузить Bundle…' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await drop('[role="dialog"]', bytes, 'valid.endge-bundle.gz')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await drop('body', [123, 98, 114, 111, 107, 101, 110], 'bad.gz')
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate(() => (window as any).inspectionFixture.Endge.program.programId)).toBe(programId)
  expect(page.url()).toBe(url)
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(errors).toEqual([])
})

test('build result collects description and commit message for release', async ({ page }, info) => {
  const errors: string[] = []
  collectErrors(page, errors)
  await ready(page, 'build')
  // The form uses real Core compilation/Worker packing; publication is isolated here.
  // Actual multipart HTTP/PostgreSQL transaction is covered by release_build_test.go.
  await page.evaluate(() => {
    const fixture = (window as any).inspectionFixture
    Object.defineProperty(fixture.Configurator.context, 'workspaceRole', { get: () => 'admin' })
    const build = fixture.Endge.buildSavedProgram.bind(fixture.Endge)
    fixture.Endge.buildSavedProgram = async (signal: AbortSignal) => {
      await build(signal)
      return { workspace: { identity: 'fixture', state: { id: 'workspace-id', headSequence: 7, generation: 'generation-a' } } }
    }
    const releases = fixture.Configurator.releases
    releases.load = async () => undefined
    Object.defineProperty(releases, 'commits', { get: () => [] })
    releases.createFromBuild = async (input: unknown, bytes: Uint8Array) => {
      fixture.published = { input, signature: Array.from(bytes.slice(0, 2)) }
      return { identity: 'release-fixture' }
    }
  })
  await page.getByRole('button', { name: 'Собрать и скачать' }).click()
  await expect(page.getByTestId('build-result')).toBeVisible()
  await page.getByRole('button', { name: 'Создать релиз', exact: true }).click()
  await page.getByLabel('Название релиза', { exact: true }).fill('release-fixture')
  await page.getByLabel('Описание', { exact: true }).fill('Комментарий к сборке')
  await page.getByLabel('Сообщение коммита', { exact: true }).fill('Сохранить собранную модель')
  await page.screenshot({ path: info.outputPath('release-build-dialog.png') })
  await page.locator('button[form="publish-build"]').click()
  await expect(page.getByRole('status')).toContainText('release-fixture')
  expect(await page.evaluate(() => (window as any).inspectionFixture.published)).toMatchObject({
    signature: [31, 139],
    input: { identity: 'release-fixture', description: 'Комментарий к сборке', commitMessage: 'Сохранить собранную модель', source: { headSequence: 7 }, buildMetadata: { version: 1, fileFormat: 'gzip', runtime: 'ts-browser' } },
  })
  expect(errors).toEqual([])
})

test('compiled catalog uses familiar sections and readonly document shell without parsing', async ({ page }, info) => {
  const errors: string[] = []
  collectErrors(page, errors)
  const container = JSON.parse(await readFile('../../packages/@endge-core/src/test/fixtures/bundles/program.json', 'utf8'))
  const catalog = container.bundle.catalog
  const entry = Object.values(catalog.documents).find((value: any) => value.entityType === 'component-sfc') as any
  catalog.folders = {
    ...catalog.folders,
    'root-components': { id: 'root-components', identity: 'root-components', displayName: 'root-components', parentId: null, scope: 'collection', entityType: 'components', position: 0 },
    'root-actions': { id: 'root-actions', identity: 'root-actions', displayName: 'root-actions', parentId: null, scope: 'collection', entityType: 'actions', position: 1 },
    'custom': { id: 'custom', identity: 'custom', displayName: 'Мои компоненты', parentId: 'root-components', scope: 'collection', entityType: 'components', position: 0 },
  }
  entry.folderId = 'custom'
  catalog.folders.model = { id: 'model', identity: 'root-workspace-files', displayName: 'Модель', parentId: null, scope: 'workspace', entityType: null, position: 5 }
  catalog.folders.screens = { id: 'screens', identity: 'screens', displayName: 'Экраны', parentId: 'model', scope: 'workspace', entityType: null, position: 6, icon: 'Monitor', color: '#aabbcc' }
  entry.workspaceFolderId = 'screens'
  await ready(page, 'debugger')
  await page.evaluate(() => {
    const fixture = (window as any).inspectionFixture
    fixture.Endge.source.parse = () => {
      throw new Error('Inspection must not parse Source')
    }
    fixture.Endge.build = () => {
      throw new Error('Inspection must not build')
    }
    fixture.Endge.compiler.build = () => {
      throw new Error('Inspection must not compile')
    }
  })
  await page.getByRole('button', { name: 'Приложение для удалённой отладки' }).click()
  await page.getByRole('menuitem', { name: 'Загрузить Bundle…' }).click()
  await page.getByTestId('bundle-file-input').setInputFiles({ name: 'catalog.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(container)) })
  await expect(page.getByTestId('bundle-summary')).toBeVisible()
  await page.getByRole('button', { name: 'Открыть инспекцию' }).click()
  const components = page.getByRole('treeitem', { name: 'Компоненты', exact: true })
  await expect(components.locator('.text-blue-500').first()).toBeVisible()
  await expect(page.getByRole('treeitem', { name: 'Действия', exact: true }).locator('.text-amber-500').first()).toBeVisible()
  await expect(page.getByRole('treeitem', { name: 'root-components', exact: true })).toHaveCount(0)
  await expect(page.getByRole('treeitem', { name: /^Region/ }).locator('.text-current').first()).toBeVisible()
  await components.click()
  await page.getByRole('treeitem', { name: 'Мои компоненты', exact: true }).click()
  const document = page.getByRole('treeitem', { name: entry.displayName, exact: true })
  await document.click()
  await expect(document).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('compiled-document-settings')).toBeVisible()
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(entry.displayName)
  await expect(page.getByLabel('Название', { exact: true })).toHaveAttribute('readonly', '')
  await expect(page.getByRole('button', { name: 'Скопировать identity', exact: true })).toBeEnabled()
  await page.screenshot({ path: info.outputPath('compiled-document-general.png') })
  await expect(page.getByText('Сущности', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Показать структуру «Рабочее пространство»', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Модель', exact: true }).click()
  await page.getByRole('treeitem', { name: 'Экраны', exact: true }).click()
  await expect(page.getByRole('treeitem', { name: entry.displayName, exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('treeitem', { name: 'Компоненты', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Поиск по домену', exact: true }).click()
  await page.getByRole('textbox', { name: 'Поиск по домену', exact: true }).fill(entry.displayName)
  await expect(page.getByRole('treeitem', { name: entry.displayName, exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Подсветка отключена/ }).click()
  await expect(page.locator('.domain-root-hierarchy--root-highlighted').first()).toBeVisible()
  await page.screenshot({ path: info.outputPath('compiled-workspace-tree.png') })
  await page.getByRole('button', { name: 'Вернуть структуру «Frontend»', exact: true }).click()
  await expect(page.getByRole('treeitem', { name: 'Мои компоненты', exact: true })).toBeVisible()
  await expect(page.getByRole('treeitem', { name: entry.displayName, exact: true })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'Текст', exact: true }).click()
  await expect(page.getByLabel('Восстановлено из AST, только чтение').or(page.getByText('Source недоступен в этом Bundle:', { exact: false }))).toBeVisible()
  await page.getByRole('tab', { name: 'AST', exact: true }).click()
  await page.getByRole('tab', { name: 'Артефакт', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Скачать артефакт JSON' })).toBeVisible()
  await page.getByRole('tab', { name: 'Диагностика', exact: true }).click()
  expect(await page.evaluate(() => (window as any).inspectionFixture.Endge.runtime.getRuntimeHosts().length)).toBe(0)
  expect(errors).toEqual([])
})
