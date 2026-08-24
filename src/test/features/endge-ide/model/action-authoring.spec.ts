import { describe, expect, it } from 'vitest'
import { Endge, RAction } from '@endge/core'
import { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'

describe('Action authoring', () => {
  it('creates and round-trips canonical Action Source without normalization', () => {
    const source = Endge.source.createDefault('action')
    const action = RAction.fromPlain({ id: 1, identity: 'orders.save', displayName: 'Save', source, sourceVersion: 1 })
    const editor = new RActionEditor()
    editor.fillFromSource(action)
    const target = new RAction()
    editor.updateSource(target)
    expect(target.source).toBe(source)
    expect(target.sourceVersion).toBe(1)
  })

  it('marks code-owned definitions read-only', () => {
    const action = RAction.fromPlain({ identity: 'local.open', displayName: 'Open', source: '', origin: { kind: 'local', owner: 'app' } })
    action.origin = { kind: 'local', owner: 'app' }
    const editor = new RActionEditor()
    editor.fillFromSource(action)
    expect(editor.readOnly).toBe(true)
  })
})
