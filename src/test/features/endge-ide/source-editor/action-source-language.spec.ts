import { describe, expect, it } from 'vitest'
import { Endge } from '@endge/core'

describe('Action Source language', () => {
  it('provides Action DSL completions and source diagnostics', () => {
    const completions = Endge.source.completions('action', { source: '', position: { lineNumber: 1, column: 1 } })
    expect(completions.map(item => item.label)).toEqual(expect.arrayContaining(['defineAction', 'operation', 'query', 'update', 'action']))
    const diagnostics = Endge.source.validate('action', `defineAction({ steps: { edit: operation({ input: {}, run: { steps: {} } }) } })`).diagnostics as Array<{ code: string }>
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'action-operation-undo-required' }))
  })
})
