import { RStyle } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { RStyleEditor } from '@/features/endge-ide/domain/entities/RStyleEditor'

describe('редактор RStyle', () => {
  it('сохраняет при двустороннем преобразовании только поля с приоритетом Source', () => {
    const style = RStyle.fromPlain({
      id: 9,
      identity: 'flight-board',
      displayName: 'Flight board',
      description: 'Initial description',
      source: 'opaque EndgeCSS source',
      sourceVersion: 1,
    })
    const editor = new RStyleEditor()
    editor.fillFromSource(style)
    editor.description = 'Updated description'
    editor.applySourceText('updated opaque EndgeCSS source')
    editor.sourceVersion = 2
    editor.updateSource(style)

    expect(style).toMatchObject({
      identity: 'flight-board',
      displayName: 'Flight board',
      description: 'Updated description',
      source: 'updated opaque EndgeCSS source',
      sourceVersion: 2,
    })
    expect(style.toPlain()).not.toHaveProperty('styles')
  })

  it('разрешает пустой Source до появления грамматики EndgeCSS', () => {
    const editor = new RStyleEditor()
    editor.identity = 'custom-style'
    editor.source = ''
    editor.sourceVersion = 1

    editor.refreshDiagnostics()

    expect(editor.diagnostics).toEqual([])
  })

  it('защищает системный identity, разрешая обновления Source', () => {
    const style = RStyle.fromPlain({
      id: 1,
      identity: 'default',
      displayName: 'Default',
      source: 'old',
      managedBy: 'system',
      managedById: null,
    })
    const editor = new RStyleEditor()
    editor.fillFromSource(style)
    editor.identity = 'changed'
    editor.name = 'Changed'
    editor.source = 'new'

    editor.updateSource(style)

    expect(style.identity).toBe('default')
    expect(style.displayName).toBe('Default')
    expect(style.source).toBe('new')
  })
})
