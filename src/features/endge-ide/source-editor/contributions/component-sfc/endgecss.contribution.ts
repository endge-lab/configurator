import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'

import { compileEndgeCSS, Endge } from '@endge/core'

const STYLE_PATTERN = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi

export interface SFCStyleEditorDiagnostic {
  start: number
  end: number
  severity: string
  message: string
}

export function collectSFCStyleEndgeCSSDiagnostics(source: string): SFCStyleEditorDiagnostic[] {
  const diagnostics: SFCStyleEditorDiagnostic[] = []
  for (const match of source.matchAll(STYLE_PATTERN)) {
    const attrs = match[1] ?? ''
    const content = match[2] ?? ''
    const openingLength = match[0].indexOf('>') + 1
    const base = (match.index ?? 0) + openingLength
    const lang = attrs.match(/\blang\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (lang && lang !== 'endgecss') {
      diagnostics.push({ start: base, end: base + Math.max(1, content.length), severity: 'error', message: `style lang="${lang}" is unsupported; use endgecss or omit lang.` })
      continue
    }
    const result = compileEndgeCSS(content)
    diagnostics.push(...result.diagnostics.map(diagnostic => ({
      start: base + (diagnostic.range?.start ?? 0),
      end: base + (diagnostic.range?.end ?? Math.max(1, content.length)),
      severity: diagnostic.severity,
      message: diagnostic.message,
    })))
  }
  return diagnostics
}

/** Adds EndgeCSS diagnostics/completions to style blocks inside an HTML SFC model. */
export function createSFCStyleEndgeCSSContribution(): ScriptEditorExtension {
  return {
    id: 'component-sfc:endgecss',
    install({ monaco, model }) {
      const validate = () => {
        const source = model.getValue()
        const markers = collectSFCStyleEndgeCSSDiagnostics(source)
          .map(diagnostic => toMarker(monaco, model, diagnostic.start, diagnostic.end, diagnostic.severity, diagnostic.message))
        monaco.editor.setModelMarkers(model, 'endgecss-sfc', markers)
      }

      const content = model.onDidChangeContent(validate)
      const completion = monaco.languages.registerCompletionItemProvider('html', {
        triggerCharacters: ['@', ':', '.', '#', '-'],
        provideCompletionItems(currentModel, position) {
          if (currentModel !== model) return { suggestions: [] }
          const offset = model.getOffsetAt(position)
          const block = Array.from(model.getValue().matchAll(STYLE_PATTERN)).find((match) => {
            const start = (match.index ?? 0) + match[0].indexOf('>') + 1
            return offset >= start && offset <= start + (match[2]?.length ?? 0)
          })
          if (!block) return { suggestions: [] }
          const word = model.getWordUntilPosition(position)
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
          const suggestions = Endge.source.completions('style', { source: block[2] ?? '' }).map(item => ({
            label: item.label,
            kind: item.kind === 'snippet' ? monaco.languages.CompletionItemKind.Snippet : monaco.languages.CompletionItemKind.Function,
            insertText: item.insertText,
            insertTextRules: item.kind === 'snippet' ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            detail: item.detail,
            range,
          }))
          return { suggestions }
        },
      })
      validate()
      return {
        dispose() {
          monaco.editor.setModelMarkers(model, 'endgecss-sfc', [])
          content.dispose()
          completion.dispose()
        },
      }
    },
  }
}

function toMarker(
  monaco: typeof import('monaco-editor'),
  model: import('monaco-editor').editor.ITextModel,
  start: number,
  end: number,
  severity: string,
  message: string,
): import('monaco-editor').editor.IMarkerData {
  const startPosition = model.getPositionAt(Math.max(0, start))
  const endPosition = model.getPositionAt(Math.max(start + 1, end))
  return {
    severity: severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    message,
    startLineNumber: startPosition.lineNumber,
    startColumn: startPosition.column,
    endLineNumber: endPosition.lineNumber,
    endColumn: endPosition.column,
  }
}
