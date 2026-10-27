import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/src/test/e2e/sandbox.html')
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true')
})

test('Worker выполняет вычисления и изолирует возможности host', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sandbox = window.sandboxFixture.create({ workerCount: 1, watchdogMs: 5000 })
    try {
      return await sandbox.execute({
        computationIdentity: 'browser',
        outputName: 'value',
        moduleKey: 'browser-isolation',
        source: 'function(inputs, api) { return { total: api.sum(inputs.values), capabilities: [typeof fetch, typeof window, typeof process] } }',
        inputs: { values: [1, 2, 3] },
      })
    }
    finally {
      sandbox.dispose()
    }
  })
  expect(result).toEqual({ total: 6, capabilities: ['undefined', 'undefined', 'undefined'] })
})

test('Worker продолжает работу после бесконечного цикла и исчерпания памяти', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sandbox = window.sandboxFixture.create({ workerCount: 1, watchdogMs: 5000 })
    const failures: string[] = []
    try {
      for (const [index, source] of ['function() { while (true) {} }', 'function() { return new Array(10000000).fill("large") }'].entries()) {
        try {
          await sandbox.execute({ computationIdentity: 'limits', outputName: 'value', moduleKey: `limit-${index}`, source, inputs: {} })
        }
        catch (error) {
          failures.push(String(error))
        }
      }
      const value = await sandbox.execute({ computationIdentity: 'limits', outputName: 'value', moduleKey: 'recovery', source: 'function() { return 42 }', inputs: {} })
      return { failures, value }
    }
    finally {
      sandbox.dispose()
    }
  })
  expect(result.failures).toHaveLength(2)
  expect(result.value).toBe(42)
})

test('dispose завершает активное вычисление и позволяет создать новый Sandbox', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sandbox = window.sandboxFixture.create({ workerCount: 1 })
    const pending = sandbox.execute({ computationIdentity: 'dispose', outputName: 'value', moduleKey: 'dispose', source: 'function() { while (true) {} }', inputs: {} })
    const failure = pending.then(() => 'unexpected success', error => String(error))
    await Promise.resolve()
    sandbox.dispose()
    const next = window.sandboxFixture.create({ workerCount: 1, watchdogMs: 5000 })
    try {
      return {
        failure: await failure,
        value: await next.execute({ computationIdentity: 'new', outputName: 'value', moduleKey: 'new', source: 'function() { return "ready" }', inputs: {} }),
      }
    }
    finally {
      next.dispose()
    }
  })
  expect(result.failure).toContain('disposed')
  expect(result.value).toBe('ready')
})
