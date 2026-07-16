import { RStyle } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { RStyleEditor } from '@/features/endge-ide/domain/entities/RStyleEditor'

describe('rStyleEditor', () => {
  it('round-trips only source-first authored fields', () => {
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

  it('allows empty source before the EndgeCSS grammar exists', () => {
    const editor = new RStyleEditor()
    editor.identity = 'custom-style'
    editor.source = ''
    editor.sourceVersion = 1

    editor.refreshDiagnostics()

    expect(editor.diagnostics).toEqual([])
  })
})
