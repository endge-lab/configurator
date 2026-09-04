import { Endge } from '@endge/core'
import { describe, expect, it } from 'vitest'

describe('диагностика Action', () => {
  it('сохраняет диапазоны Source из общего компилятора', () => {
    const result = Endge.source.validate('action', `defineAction({ steps: { first: output('missing') } })`)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'action-output-forward-reference',
      severity: 'error',
      start: expect.any(Number),
      end: expect.any(Number),
    }))
  })
})
