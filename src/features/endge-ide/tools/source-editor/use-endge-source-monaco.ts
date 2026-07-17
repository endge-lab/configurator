import type * as Monaco from 'monaco-editor'
import type { Ref } from 'vue'
import type { SourceKind, SourceLanguageSyntaxDefinition } from '@endge/core'

import { Endge } from '@endge/core'
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'

interface EndgeSourceDiagnostic {
  severity?: string
  message?: string
  code?: string
  start?: number
  end?: number
}

const configuredLanguages = new Map<string, {
  syntax: SourceLanguageSyntaxDefinition
  disposables: Monaco.IDisposable[]
}>()

export interface UseEndgeSourceMonacoOptions {
  container: Ref<HTMLDivElement | null>
  sourceKind: SourceKind
  value: () => string
  onChange: (value: string) => void
  owner?: string
  onReady?: (editor: Monaco.editor.IStandaloneCodeEditor) => void
}

/** Общий browser adapter Endge source language → Monaco. */
export function useEndgeSourceMonaco(options: UseEndgeSourceMonacoOptions) {
  const editor = shallowRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const diagnosticsCount = ref(0)
  const languageId = `endge-${options.sourceKind}-source`
  const markerOwner = options.owner ?? languageId
  const languageStrategy = Endge.source.resolveLanguageStrategy(options.sourceKind)
  if (!languageStrategy)
    throw new Error(`Source language strategy is not registered for "${options.sourceKind}".`)
  const syntax = languageStrategy.syntax
  let completionDisposable: Monaco.IDisposable | null = null
  let contentDisposable: Monaco.IDisposable | null = null
  let openReferenceDisposable: Monaco.IDisposable | null = null

  const validate = () => {
    const model = editor.value?.getModel()
    if (!model)
      return
    const diagnostics = (Endge.source.validate(options.sourceKind, model.getValue()).diagnostics ?? []) as EndgeSourceDiagnostic[]
    diagnosticsCount.value = diagnostics.length
    monaco.editor.setModelMarkers(model, markerOwner, diagnostics.map(item => toMarker(model, item)))
  }

  const setValue = (value: string) => {
    if (editor.value && editor.value.getValue() !== value) {
      editor.value.setValue(value)
      validate()
    }
  }

  onMounted(() => {
    if (!options.container.value)
      return
    registerLanguage(languageId, syntax)
    completionDisposable = monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: syntax.triggerCharacters,
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
        const suggestions = Endge.source.completions(options.sourceKind, {
          source: model.getValue(),
          position: { lineNumber: position.lineNumber, column: position.column },
        }).map(item => ({
          label: item.label,
          kind: completionKind(item.kind),
          insertText: item.insertText,
          insertTextRules: item.kind === 'snippet'
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          detail: item.detail,
          documentation: item.documentation,
          range,
        }))
        return { suggestions }
      },
    })
    editor.value = monaco.editor.create(options.container.value, {
      value: options.value(),
      language: languageId,
      theme: 'vs-dark',
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 14,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      formatOnPaste: true,
      formatOnType: true,
      scrollBeyondLastLine: true,
      padding: { bottom: 10 },
    })
    openReferenceDisposable = editor.value.addAction({
      id: 'endge.open-source-reference',
      label: 'Открыть связанный документ',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
      run(instance) {
        const model = instance.getModel()
        const position = instance.getPosition()
        if (!model || !position) {
          return
        }
        const reference = Endge.source.referenceAt(options.sourceKind, {
          source: model.getValue(),
          position: { lineNumber: position.lineNumber, column: position.column },
        })
        if (!reference) {
          toast.info('Под курсором нет ссылки на документ')
          return
        }
        EndgeIDE.tabs.openSourceReference(reference)
      },
    })
    options.onReady?.(editor.value)
    contentDisposable = editor.value.onDidChangeModelContent(() => {
      options.onChange(editor.value?.getValue() ?? '')
      validate()
    })
    validate()
  })

  onBeforeUnmount(() => {
    const model = editor.value?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, markerOwner, [])
    contentDisposable?.dispose()
    completionDisposable?.dispose()
    openReferenceDisposable?.dispose()
    editor.value?.dispose()
    model?.dispose()
    editor.value = null
  })

  return { editor, diagnosticsCount, setValue, validate, languageId }
}

function registerLanguage(
  languageId: string,
  syntax: SourceLanguageSyntaxDefinition,
): void {
  if (!monaco.languages.getLanguages().some(item => item.id === languageId)) {
    monaco.languages.register({
      id: languageId,
      aliases: syntax.aliases,
      extensions: syntax.extensions,
    })
  }
  const configured = configuredLanguages.get(languageId)
  if (configured?.syntax === syntax)
    return
  configured?.disposables.forEach(disposable => disposable.dispose())

  const languageConfiguration = monaco.languages.setLanguageConfiguration(languageId, {
    comments: syntax.comments,
    brackets: syntax.brackets,
    autoClosingPairs: syntax.autoClosingPairs,
  })
  const tokensProvider = monaco.languages.setMonarchTokensProvider(languageId, {
    tokenizer: Object.fromEntries(
      Object.entries(syntax.tokenizer).map(([state, rules]) => [
        state,
        rules.map(rule => rule.next
          ? [rule.pattern, rule.token, rule.next]
          : [rule.pattern, rule.token]),
      ]),
    ),
  } as Monaco.languages.IMonarchLanguage)
  configuredLanguages.set(languageId, {
    syntax,
    disposables: [languageConfiguration, tokensProvider],
  })
}

function completionKind(kind: string): Monaco.languages.CompletionItemKind {
  if (kind === 'property')
    return monaco.languages.CompletionItemKind.Property
  if (kind === 'value')
    return monaco.languages.CompletionItemKind.Value
  if (kind === 'keyword')
    return monaco.languages.CompletionItemKind.Keyword
  if (kind === 'snippet')
    return monaco.languages.CompletionItemKind.Snippet
  return monaco.languages.CompletionItemKind.Function
}

function toMarker(model: Monaco.editor.ITextModel, diagnostic: EndgeSourceDiagnostic): Monaco.editor.IMarkerData {
  const length = model.getValueLength()
  const start = Math.max(0, Math.min(diagnostic.start ?? 0, length))
  const end = Math.max(start + 1, Math.min(diagnostic.end ?? start + 1, length))
  const startPosition = model.getPositionAt(start)
  const endPosition = model.getPositionAt(Math.min(end, length))
  return {
    severity: diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    message: diagnostic.message ?? diagnostic.code ?? 'Source diagnostic',
    startLineNumber: startPosition.lineNumber,
    startColumn: startPosition.column,
    endLineNumber: endPosition.lineNumber,
    endColumn: endPosition.column === startPosition.column && endPosition.lineNumber === startPosition.lineNumber
      ? endPosition.column + 1
      : endPosition.column,
  }
}
