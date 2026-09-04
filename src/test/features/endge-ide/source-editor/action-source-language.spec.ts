import { Endge } from '@endge/core'
import { describe, expect, it } from 'vitest'

describe('язык Action Source', () => {
  it('предоставляет автодополнение Action DSL и диагностику Source', () => {
    const completions = Endge.source.completions('action', {
      source: '',
      position: { lineNumber: 1, column: 1 },
      documentSymbols: [{ target: 'action', identity: 'orders.save', displayName: 'Save order' }],
    })
    expect(completions.map(item => item.label)).toEqual(expect.arrayContaining(['defineAction', 'operation', 'query', 'update', 'action', 'orders.save']))
    const diagnostics = Endge.source.validate('action', `defineAction({ steps: { edit: operation({ input: {}, run: { steps: {} } }) } })`).diagnostics as Array<{ code: string }>
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'action-operation-undo-required' }))
  })

  it('предоставляет документированные сигнатуры вызовов', () => {
    const source = `computation('orders.total', {})`
    const signature = Endge.source.signatureHelp('action', {
      source,
      position: { lineNumber: 1, column: source.indexOf(',') + 2 },
    })
    expect(signature).toMatchObject({
      activeParameter: 1,
      signatures: [{ label: 'computation(identity, input)' }],
    })
  })
})
