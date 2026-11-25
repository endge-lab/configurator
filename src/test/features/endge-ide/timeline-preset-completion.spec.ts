import type * as Monaco from 'monaco-editor'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import { createDefaultEndgeConfiguration, Endge } from '@endge/core'
import { afterEach, expect, it, vi } from 'vitest'
import { createSFCLanguageContribution } from '@/features/endge-ide/source-editor/contributions/component-sfc/language.contribution'

afterEach(() => vi.restoreAllMocks())

it('suggests current Timeline presets in the static preset attribute', () => {
  vi.spyOn(Endge.configuration, 'current', 'get').mockReturnValue(createDefaultEndgeConfiguration())
  const source = '<template><TimelineChart preset="rms-old" /></template>'
  let presets = [{ name: 'rms-load', label: 'RMS' }]
  let provider: Monaco.languages.CompletionItemProvider | undefined
  const disposable = { dispose: vi.fn() }
  const positionAt = (offset: number) => ({ lineNumber: 1, column: offset + 1 })
  const model = {
    getValue: () => source,
    getOffsetAt: ({ column }: Monaco.IPosition) => column - 1,
    getPositionAt: positionAt,
    onDidChangeContent: () => disposable,
  }
  const editor = { createDecorationsCollection: () => ({ set: vi.fn(), clear: vi.fn() }) }
  const monaco = {
    MarkerSeverity: { Error: 8 },
    editor: { setModelMarkers: vi.fn() },
    languages: {
      CompletionItemKind: { Value: 1 },
      registerCompletionItemProvider: (_language: string, value: Monaco.languages.CompletionItemProvider) => {
        provider = value
        return disposable
      },
      registerFoldingRangeProvider: () => disposable,
      registerHoverProvider: () => disposable,
    },
    Range: { fromPositions: (start: Monaco.IPosition, end: Monaco.IPosition) => ({ start, end }) },
  }
  const resource = createSFCLanguageContribution({ resolveTimelinePresets: () => presets })
    .install({ editor, model, monaco } as unknown as Parameters<ScriptEditorExtension['install']>[0])
  try {
    const start = source.indexOf('rms-old')
    const invoke = () => provider?.provideCompletionItems(
      model as unknown as Monaco.editor.ITextModel,
      positionAt(start + 3) as Monaco.Position,
      {} as Monaco.languages.CompletionContext,
      {} as Monaco.CancellationToken,
    )
    expect(invoke()).toMatchObject({ suggestions: [{
      label: 'rms-load',
      insertText: 'rms-load',
      range: { start: positionAt(start), end: positionAt(start + 'rms-old'.length) },
    }] })
    presets = [{ name: 'rms-shifts', label: 'Смены' }]
    expect(invoke()).toMatchObject({ suggestions: [{ label: 'rms-shifts' }] })
    presets = []
    expect(invoke()).toEqual({ suggestions: [] })
  }
  finally {
    resource?.dispose()
  }
})
