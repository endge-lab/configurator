import { expect, test } from '@playwright/test'

test.beforeEach(async ({ request }) => {
  await request.post('/__collection-window/control', { data: { reset: true } })
})

test('real Source windows: geometry, bounded memory, retry, generations and isolation', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/src/test/e2e/collection-window.html')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  const win = (index: number) => page.locator(`[data-window="${index}"]`)
  const status = async (index: number) =>
    JSON.parse((await win(index).locator('[data-status]').textContent())!) as {
      loadedRowCount: number
      rowsRevision: number
      first: string
      last: string
      loading: boolean
      error: unknown
      overLimit: boolean
    }
  await expect
    .poll(async () => (await status(0)).loadedRowCount)
    .toBeGreaterThanOrEqual(40)
  await expect
    .poll(async () => (await status(1)).loadedRowCount)
    .toBeGreaterThanOrEqual(40)
  await expect.poll(async () => (await status(0)).loading).toBe(false)
  await expect.poll(async () => (await status(1)).loading).toBe(false)
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    const fixture = (window as any).collectionWindowFixture
    fixture.viewports = []
    const controller = fixture.controllers[0]
    const original = controller.command.bind(controller)
    controller.command = (name: string, input: unknown) => {
      if (name === 'setViewport') {
        fixture.viewports.push(input)
      }
      return original(name, input)
    }
  })
  await win(0).locator('[data-controller-inspection] > summary').click()
  await expect(win(0).locator('[data-controller-preview]')).toBeVisible()
  await expect(win(0).locator('[data-controller-preview]')).toContainText(
    'endge.collection-window.default',
  )
  await expect(win(0).locator('[data-controller-preview]')).toContainText(
    'outputs',
  )
  await win(0).locator('[data-controller-inspection] > summary').click()
  const view = win(0).locator('.endge-tanstack-table__viewport')
  await view.evaluate((el) => {
    el.scrollTop = 200
  })
  await expect
    .poll(async () => await view.evaluate(el => el.scrollTop))
    .toBe(200)
  const anchor = async () =>
    view.evaluate((el) => {
      const header = el.querySelector('thead')!.getBoundingClientRect()
      const rows = Array.from(
        el.querySelectorAll<HTMLElement>('[data-row-key]'),
      )
      const row = rows.find(
        row => row.getBoundingClientRect().bottom > header.bottom,
      )!
      return {
        key: row.dataset.rowKey,
        offset: row.getBoundingClientRect().top - header.bottom,
      }
    })
  const requestLog = async () =>
    (await (await request.get('/__collection-window/requests')).json()) as {
      direction: string
      offset?: number
      cursor?: string
    }[]
  const originalFirst = Number((await status(0)).first)
  const requestsBefore = (await requestLog()).length
  const before = await anchor()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).collectionWindowFixture.viewports.at(-1)?.firstVisible,
      ),
    )
    .toEqual({ key: before.key, index: 6 })
  const range = await page.evaluate(() =>
    (window as any).collectionWindowFixture.viewports.at(-1),
  )
  expect(range.rowsRevision).toBe((await status(0)).rowsRevision)
  expect(range.lastVisible.index).toBeLessThan(18)

  await win(0).locator('[data-command="loadBefore"]').click()
  await expect
    .poll(async () => (await status(0)).first)
    .toBe(String(originalFirst - 40))
  await expect.poll(anchor).toEqual(before)
  await expect
    .poll(async () => (await requestLog()).length)
    .toBe(requestsBefore + 1)
  await page.waitForTimeout(250)
  expect((await requestLog()).length).toBe(requestsBefore + 1)
  expect((await status(0)).loadedRowCount).toBeLessThanOrEqual(80)
  expect(await win(0).locator('[data-row-key]').count()).toBeLessThan(45)
  // Retain an earlier block while the viewport protects the next block.
  await win(0).locator('[data-control="retain"]').click()
  const trimAnchor = await anchor()
  await win(0).locator('[data-control="cap"]').fill('10')
  await win(0).locator('[data-control="cap"]').dispatchEvent('change')
  await expect.poll(async () => (await status(0)).loadedRowCount).toBe(80)
  await expect.poll(async () => (await status(0)).overLimit).toBe(true)
  await expect.poll(anchor).toEqual(trimAnchor)
  await win(0).locator('[data-control="release"]').click()
  await expect.poll(async () => (await status(0)).loadedRowCount).toBe(40)
  await expect
    .poll(async () => (await status(0)).first)
    .toBe(String(originalFirst))
  await expect.poll(anchor).toEqual(trimAnchor)
  await win(0).locator('[data-control="cap"]').fill('80')
  await win(0).locator('[data-control="cap"]').dispatchEvent('change')
  await win(0).locator('[data-command="loadAfter"]').click()
  await expect.poll(async () => (await status(0)).loadedRowCount).toBe(80)
  // The same intrinsic action must act only on its originating Table.
  const otherScroll = await win(1)
    .locator('.endge-tanstack-table__viewport')
    .evaluate(el => el.scrollTop)
  const row = win(0).locator(`[data-row-key="${before.key}"]`)
  await row.dblclick()
  await expect.poll(async () => (await anchor()).offset).toBe(0)
  expect(
    await win(1)
      .locator('.endge-tanstack-table__viewport')
      .evaluate(el => el.scrollTop),
  ).toBe(otherScroll)
  // A failing initial load is visible and explicitly retried.
  await win(1).locator('[data-control="fail"]').check()
  await expect.poll(async () => Boolean((await status(1)).error)).toBe(true)
  await win(1).locator('[data-control="fail"]').uncheck()
  await win(1).locator('[data-command="retry"]').click()
  await expect.poll(async () => (await status(1)).error).toBe(null)
  await expect
    .poll(async () => (await status(1)).loadedRowCount)
    .toBeGreaterThan(0)
  // Input generation changes cancel the old slow response.
  await win(0).locator('[data-control="delay"]').fill('500')
  await win(0).locator('[data-control="delay"]').dispatchEvent('change')
  await win(0).locator('[data-control="filter"]').selectOption('blue')
  await win(0).locator('[data-control="delay"]').fill('0')
  await win(0).locator('[data-control="delay"]').dispatchEvent('change')
  await win(0).locator('[data-control="filter"]').selectOption('green')
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (
          (window as any).collectionWindowFixture.controllers[0].getOutputs().rows as { label: string }[]
        ).every(row => row.label.startsWith('green')),
      ),
    )
    .toBe(true)
  await expect
    .poll(async () => (await status(0)).loadedRowCount)
    .toBeGreaterThan(0)
  await page.waitForTimeout(650)
  expect((await status(0)).loadedRowCount).toBeGreaterThan(0)
  expect(
    await page.evaluate(() =>
      (
        (window as any).collectionWindowFixture.controllers[0].getOutputs().rows as { label: string }[]
      ).every(row => row.label.startsWith('green')),
    ),
  ).toBe(true)
  expect((await status(1)).loadedRowCount).toBeGreaterThan(0)
  expect(
    await page.evaluate(() =>
      (
        (window as any).collectionWindowFixture.controllers[1].getOutputs().rows as { label: string }[]
      ).every(row => row.label.startsWith('all')),
    ),
  ).toBe(true)
  const requests = (await (
    await request.get('/__collection-window/requests')
  ).json()) as { direction: string, offset?: number, cursor?: string }[]
  expect(requests.length - requestsBefore).toBeGreaterThanOrEqual(6)
  const idleCount = requests.length
  await page.waitForTimeout(250)
  expect((await requestLog()).length).toBe(idleCount)
  expect(requests.some(item => item.direction === 'before')).toBe(true)
  expect(requests.some(item => typeof item.offset === 'number')).toBe(true)
  expect(requests.some(item => typeof item.cursor === 'string')).toBe(true)
  expect(errors).toEqual([])
  await expect(page.locator('[data-errors]')).toBeEmpty()
})

test('actual Source editor completion, linked diagnostics, draft Preview and disposal', async ({
  page,
}) => {
  const errors: string[] = []
  const backendRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4999')) {
      backendRequests.push(request.url())
    }
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/src/test/e2e/collection-window.html')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).collectionWindowFixture.controllers.every(
          (controller: any) =>
            controller.getOutputs().loadedRowCount >= 80
            && !controller.getOutputs().loading,
        ),
      ),
    )
    .toBe(true)
  const revisions = await page.evaluate(() =>
    (window as any).collectionWindowFixture.controllers.map(
      (controller: any) => controller.getOutputs().rowsRevision,
    ),
  )
  await page.evaluate(() =>
    localStorage.setItem(
      'endge:configurator:active-backend-url:v1',
      'http://127.0.0.1:4999',
    ),
  )
  await page.locator('[data-source-acceptance] > summary').click()
  const panel = page.locator('[data-source-panel]')
  await expect(panel).toHaveAttribute('data-source-ready', 'true')
  expect(
    await page.evaluate(() =>
      localStorage.getItem('endge:configurator:active-backend-url:v1'),
    ),
  ).toBe('http://127.0.0.1:4999')
  const control = (name: string) =>
    panel.locator(`[data-source-control="${name}"]`)
  await control('completion').click()
  await panel
    .locator('.monaco-editor .view-line')
    .first()
    .click({ timeout: 5000 })
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('Control+Space')
  const completion = page
    .getByRole('option')
    .filter({ hasText: 'endge.collection-window' })
    .first()
  await expect(completion).toBeVisible()
  await completion.click()
  await page.keyboard.press('Escape')
  await control('valid').click()
  await control('compile').click()
  await expect(panel.locator('[data-source-status]')).toHaveText(
    'Compile: valid',
  )
  await expect(panel.locator('[data-source-diagnostics]')).toHaveText('[]')
  await expect(panel.locator('[data-source-dependencies]')).toContainText(
    'Collection window',
  )
  await expect(panel.locator('[data-source-dependencies]')).toContainText(
    'window-commit',
  )
  await control('command').click()
  await control('compile').click()
  await expect(panel.locator('[data-source-status]')).toHaveText(
    'Compile: error',
  )
  await expect(panel.locator('[data-source-diagnostics]')).toContainText(
    'notACommand',
  )
  await control('dependency').click()
  await control('compile').click()
  await expect(panel.locator('[data-source-status]')).toHaveText(
    'Compile: error',
  )
  await expect(panel.locator('[data-source-diagnostics]')).toContainText(
    'controller-state-update-invalid',
  )
  await expect(panel.locator('[data-source-diagnostics]')).toContainText(
    'runtimes.window.withDependencies.state',
  )
  await control('valid').click()
  await control('preview').click()
  await expect(panel.locator('[data-source-status]')).toHaveText(
    'Compile: valid',
  )
  await expect(panel.locator('[data-source-preview]')).not.toHaveAttribute(
    'data-runtime-id',
    '',
  )
  await expect(
    panel.locator('[data-source-preview] [data-row-key]').first(),
  ).toBeVisible()
  await expect(panel.locator('[data-source-error]')).toBeEmpty()
  await expect(
    panel.locator('[data-source-preview] [data-controller-preview]'),
  ).toContainText('outputs')
  expect(
    await page.evaluate(() =>
      (window as any).collectionWindowFixture.controllers.map(
        (controller: any) => controller.getOutputs().rowsRevision,
      ),
    ),
  ).toEqual(revisions)
  await control('stop').click()
  await expect(panel.locator('[data-source-preview]')).toHaveAttribute(
    'data-runtime-id',
    '',
  )
  expect(
    await page.evaluate(
      () =>
        (
          window as any
        ).collectionWindowFixture.Endge.runtime.getRuntimeHostsByEntity(
          'composition',
          'fixture-source-preview',
        ).length,
    ),
  ).toBe(0)
  expect(
    await page.evaluate(
      () =>
        (
          window as any
        ).collectionWindowFixture.Endge.runtime.getRuntimeHostsByEntity(
          'controller',
          'endge.collection-window',
        ).length,
    ),
  ).toBe(2)
  expect(
    await page.evaluate(
      () =>
        (
          window as any
        ).collectionWindowFixture.Endge.runtime.getRuntimeHostsByEntity(
          'store',
          'window-state',
        ).length,
    ),
  ).toBe(2)
  await control('preview').click()
  await expect(panel.locator('[data-source-preview]')).not.toHaveAttribute(
    'data-runtime-id',
    '',
  )
  await page.locator('[data-source-acceptance] > summary').click()
  await expect(panel).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as any
          ).collectionWindowFixture.Endge.runtime.getRuntimeHostsByEntity(
            'composition',
            'fixture-source-preview',
          ).length,
      ),
    )
    .toBe(0)
  expect(
    await page.evaluate(() =>
      localStorage.getItem('endge:configurator:active-backend-url:v1'),
    ),
  ).toBe('http://127.0.0.1:4999')
  await page.evaluate(() =>
    localStorage.removeItem('endge:configurator:active-backend-url:v1'),
  )
  await page.locator('[data-source-acceptance] > summary').click()
  await expect(panel).toHaveAttribute('data-source-ready', 'true')
  await page.locator('[data-source-acceptance] > summary').click()
  await expect(panel).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      localStorage.getItem('endge:configurator:active-backend-url:v1'),
    ),
  ).toBe(null)
  expect(backendRequests).toEqual([])
  expect(errors).toEqual([])
})

for (const storage of ['memory', 'indexeddb']) {
  test(`page cache ${storage}: real Source, clear, refresh and native persistence`, async ({ page, request }) => {
    await request.post('/__collection-window/control', { data: { reset: true } })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/src/test/e2e/collection-window.html?cache=${storage}&cacheKey=native-${storage}&prefetchRows=0`)
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
    const read = () => page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].getOutputs())
    await expect.poll(async () => (await read()).cacheStatus.pendingWrites).toBe(0)
    await expect.poll(async () => (await read()).cacheStatus.entries).toBe(2)
    const before = (await (await request.get('/__collection-window/requests')).json()).length
    await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('reset'))
    expect((await (await request.get('/__collection-window/requests')).json()).length).toBe(before)
    expect((await read()).cacheStatus.source).toBe(storage)
    if (storage === 'indexeddb') {
      await page.reload()
      await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
      await expect.poll(async () => (await read()).loading).toBe(false)
      const afterReload = await (await request.get('/__collection-window/requests')).json()
      expect(afterReload, JSON.stringify({ requests: afterReload, status: (await read()).cacheStatus })).toHaveLength(before)
      expect((await read()).cacheStatus.source).toBe('indexeddb')
    }
    const rows = (await read()).rows
    await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('clearCache'))
    expect((await read()).rows).toEqual(rows)
    await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('refresh'))
    expect((await (await request.get('/__collection-window/requests')).json()).length).toBeGreaterThan(before)
    expect(errors).toEqual([])
  })
}

test('SWR updates values without moving the anchor and freezes structural changes', async ({ page, request }) => {
  await request.post('/__collection-window/control', { data: { reset: true } })
  await page.goto('/src/test/e2e/collection-window.html?cache=indexeddb&cacheKey=swr-native&strategy=stale-while-revalidate&maxAgeMs=1000')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  const read = () => page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].getOutputs())
  await expect.poll(async () => (await read()).loading).toBe(false)
  const view = page.locator('[data-window="0"] .endge-tanstack-table__viewport')
  await view.evaluate((el) => {
    el.scrollTop = 200
  })
  const position = await view.evaluate(el => el.scrollTop)
  await request.post('/__collection-window/control', { data: { label: '-fresh' } })
  await page.evaluate(() => {
    const original = Date.now.bind(Date)
    Date.now = () => original() + 2000
    const controller = (window as any).collectionWindowFixture.controllers[0]
    const rows = controller.getOutputs().rows
    return controller.command('setViewport', { rowsRevision: controller.getOutputs().rowsRevision, firstVisible: { key: rows[6].id, index: 6 }, lastVisible: { key: rows[14].id, index: 14 }, rowCount: rows.length })
  })
  await expect.poll(async () => (await read()).rows[0].label).toContain('-fresh')
  expect(await view.evaluate(el => el.scrollTop)).toBe(position)
  expect((await read()).refreshPending).toBe(false)
  await request.post('/__collection-window/control', { data: { shift: 1 } })
  const keys = (await read()).rows.map((row: { id: string }) => row.id)
  await page.evaluate(() => {
    const original = Date.now.bind(Date)
    Date.now = () => original() + 2000
    const controller = (window as any).collectionWindowFixture.controllers[0]
    const out = controller.getOutputs()
    return controller.command('setViewport', { rowsRevision: out.rowsRevision, firstVisible: { key: out.rows[6].id, index: 6 }, lastVisible: { key: out.rows[14].id, index: 14 }, rowCount: out.rows.length })
  })
  await expect.poll(async () => (await read()).refreshPending).toBe(true)
  expect((await read()).rows.map((row: { id: string }) => row.id)).toEqual(keys)
  expect(await view.evaluate(el => el.scrollTop)).toBe(position)
  await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('refresh'))
  expect((await read()).refreshPending).toBe(false)
})

test('foreground Query cancels background revalidation transport', async ({ page, request }) => {
  await page.goto('/src/test/e2e/collection-window.html?cache=indexeddb&cacheKey=priority-native&strategy=stale-while-revalidate&maxAgeMs=1000&prefetchRows=0')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  const read = () => page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].getOutputs())
  await expect.poll(async () => (await read()).cacheStatus.entries).toBe(2)
  await expect.poll(async () => (await read()).cacheStatus.pendingWrites).toBe(0)
  await request.post('/__collection-window/control', { data: { delay: 2000 } })
  await page.evaluate(() => {
    const original = Date.now.bind(Date)
    Date.now = () => original() + 2000
    const controller = (window as any).collectionWindowFixture.controllers[0]
    const out = controller.getOutputs()
    return controller.command('setViewport', { rowsRevision: out.rowsRevision, firstVisible: { key: out.rows[6].id, index: 6 }, lastVisible: { key: out.rows[14].id, index: 14 }, rowCount: out.rows.length })
  })
  await expect.poll(async () => (await read()).cacheStatus.revalidating).toBe(true)
  await expect.poll(async () => (await (await request.get('/__collection-window/requests')).json()).length).toBe(3)
  await request.post('/__collection-window/control', { data: { delay: 0 } })
  await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('loadAfter'))
  await expect.poll(async () => (await (await request.get('/__collection-window/requests')).json())[2].aborted).toBe(true)
  expect((await read()).loadedRowCount).toBe(80)
  expect((await read()).error).toBe(null)
})

test('native IndexedDB quota failure rolls back metadata and recovers', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: any, key?: IDBValidKey) {
      if (this.name === 'pages') {
        throw new DOMException('Fixture quota', 'QuotaExceededError')
      }
      return original.call(this, value, key)
    }
    ;
    (window as any).restoreCachePuts = () => {
      IDBObjectStore.prototype.put = original
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/src/test/e2e/collection-window.html?cache=indexeddb&cacheKey=quota-native&prefetchRows=0')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  const read = () => page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].getOutputs())
  await expect.poll(async () => (await read()).cacheStatus.error).toBe('window-cache-storage-write-failed')
  await expect.poll(async () => (await read()).cacheStatus.pendingWrites).toBe(0)
  expect((await read()).loadedRowCount).toBe(40)
  expect((await read()).error).toBe(null)
  await page.evaluate(() => (window as any).restoreCachePuts())
  await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('refresh'))
  await expect.poll(async () => (await read()).cacheStatus.pendingWrites).toBe(0)
  await expect.poll(async () => (await read()).cacheStatus.entries).toBe(1)
  expect(errors).toEqual([])
})

test('real Query transport fallback never hides authentication failures', async ({ page, request }) => {
  await page.goto('/src/test/e2e/collection-window.html?cache=memory&strategy=network-first&onError=use-cache&prefetchRows=0')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
  const read = () => page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].getOutputs())
  await expect.poll(async () => (await read()).cacheStatus.entries).toBe(2)
  for (const status of [503, 401, 403]) {
    await request.post('/__collection-window/control', { data: { fail: true, status } })
    if (status === 403) {
      await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('reset'))
    }
    await page.evaluate(() => (window as any).collectionWindowFixture.controllers[0].command('loadInitial'))
    const output = await read()
    if (status === 503) {
      expect(output.error).toBe(null)
      expect(output.cacheStatus.source).toBe('memory')
    }
    else {
      expect(output.error).not.toBe(null)
      expect(output.error.message).toContain(String(status))
    }
  }
})
