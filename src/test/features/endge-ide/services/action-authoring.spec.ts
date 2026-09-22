import { Endge, RAction } from '@endge/core'
import { describe, expect, it } from 'vitest'
import { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'

describe('редактирование Action', () => {
  it('создаёт и двусторонне преобразует канонический Action Source без нормализации', () => {
    const source = Endge.source.createDefault('action')
    const action = RAction.fromPlain({ id: 1, identity: 'orders.save', displayName: 'Save', source, sourceVersion: 1 })
    const editor = new RActionEditor()
    editor.fillFromSource(action)
    const target = new RAction()
    editor.updateSource(target)
    expect(target.source).toBe(source)
    expect(target.sourceVersion).toBe(1)
  })

  it('помечает принадлежащие коду определения доступными только для чтения', () => {
    const action = RAction.fromPlain({ identity: 'local.open', displayName: 'Open', source: '', origin: { kind: 'local', owner: 'app' } })
    action.origin = { kind: 'local', owner: 'app' }
    const editor = new RActionEditor()
    editor.fillFromSource(action)
    expect(editor.readOnly).toBe(true)
  })
})
