import { describe, expect, it } from 'vitest'
import { Endge } from '@endge/core'

describe('Action diagnostics', () => {
  it('retains source ranges from the shared compiler', () => {
    const result = Endge.source.validate('action', `defineAction({ steps: { first: output('missing') } })`)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'action-output-forward-reference',
      severity: 'error',
      start: expect.any(Number),
      end: expect.any(Number),
    }))
  })
})
