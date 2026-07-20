/* eslint-disable style/max-statements-per-line */
import type { SourceKind, SourceLanguageSyntaxDefinition } from '@endge/core'
import type * as Monaco from 'monaco-editor'
import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { resolveEditorSurfaceColor } from '@/features/endge-ide/tools/source-editor/editor-surface-theme'

const ENDGE_SOURCE_DARK_THEME = 'endge-source-dark'

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
  ownerIdentity?: () => string | undefined
  onReady?: (editor: Monaco.editor.IStandaloneCodeEditor) => void
}

/** Общий browser adapter Endge source language → Monaco. */
export function useEndgeSourceMonaco(options: UseEndgeSourceMonacoOptions) {
  const editor = shallowRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const diagnosticsCount = ref(0)
  const languageId = `endge-${options.sourceKind}-source`
  const markerOwner = options.owner ?? languageId
  const languageStrategy = Endge.source.resolveLanguageStrategy(options.sourceKind)
  if (!languageStrategy) { throw new Error(`Source language strategy is not registered for "${options.sourceKind}".`) }
  const syntax = languageStrategy.syntax
  let completionDisposable: Monaco.IDisposable | null = null
  let contentDisposable: Monaco.IDisposable | null = null
  let openReferenceDisposable: Monaco.IDisposable | null = null
  let mouseDisposable: Monaco.IDisposable | null = null
  let hoverDisposable: Monaco.IDisposable | null = null

  const typeCatalog = () => {
    const compiled = Endge.program.getTypeCatalog()
    if (compiled.length) { return compiled }
    return Endge.domain.getTypes().map((type) => {
      const primitiveKind = String(type.meta?.primitiveKind ?? '').trim()
      return {
        id: type.id,
        identity: type.identity,
        displayName: type.displayName || type.name || type.identity,
        category: primitiveKind === 'reference'
          ? 'reference' as const
          : type.isPrimitive
            ? 'primitive' as const
            : 'user' as const,
        sourceVersion: Number(type.sourceVersion ?? 1) || 1,
        definition: null,
        status: 'valid' as const,
      }
    })
  }

  const languageContext = (source: string, position?: Monaco.Position) => ({
    source,
    position: position ? { lineNumber: position.lineNumber, column: position.column } : undefined,
    ownerIdentity: options.ownerIdentity?.(),
    typeSymbols: typeCatalog().map(type => ({
      identity: type.identity,
      displayName: type.displayName,
      category: type.category,
    })),
  })

  const validate = () => {
    const model = editor.value?.getModel()
    if (!model) { return }
    const context = languageContext(model.getValue())
    const diagnostics = (Endge.source.validate(options.sourceKind, model.getValue(), context).diagnostics ?? []) as EndgeSourceDiagnostic[]
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
    if (!options.container.value) { return }
    monaco.editor.defineTheme(ENDGE_SOURCE_DARK_THEME, {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': resolveEditorSurfaceColor(),
      },
    })
    registerLanguage(languageId, syntax)
    completionDisposable = monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: syntax.triggerCharacters,
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
        const suggestions = Endge.source.completions(
          options.sourceKind,
          languageContext(model.getValue(), position),
        ).map(item => ({
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
      theme: ENDGE_SOURCE_DARK_THEME,
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
        if (!openReference(model, position)) {
          toast.info('Под курсором нет ссылки на документ')
        }
      },
    })
    mouseDisposable = editor.value.onMouseDown((event) => {
      const position = event.target.position
      if (!position || (!event.event.ctrlKey && !event.event.metaKey) || !event.event.leftButton) { return }
      if (openReference(editor.value!.getModel(), position)) {
        event.event.preventDefault()
        event.event.stopPropagation()
      }
    })
    hoverDisposable = monaco.languages.registerHoverProvider(languageId, {
      provideHover(model, position) {
        if (model !== editor.value?.getModel()) { return null }
        const reference = Endge.source.referenceAt(
          options.sourceKind,
          languageContext(model.getValue(), position),
        )
        if (!reference || reference.target !== 'type') { return null }
        const type = typeCatalog().find(item => item.identity === reference.identity)
        if (!type) { return null }
        return {
          range: monaco.Range.fromPositions(
            model.getPositionAt(reference.range.start),
            model.getPositionAt(reference.range.end),
          ),
          contents: [
            { value: `**${type.identity}**` },
            { value: `${type.category} type · ${type.displayName}` },
            ...(type.category === 'user' ? [{ value: 'Cmd/Ctrl + click — open Type Source' }] : []),
          ],
        }
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
    if (model) { monaco.editor.setModelMarkers(model, markerOwner, []) }
    contentDisposable?.dispose()
    completionDisposable?.dispose()
    openReferenceDisposable?.dispose()
    mouseDisposable?.dispose()
    hoverDisposable?.dispose()
    editor.value?.dispose()
    model?.dispose()
    editor.value = null
  })

  return { editor, diagnosticsCount, setValue, validate, languageId }

  function openReference(model: Monaco.editor.ITextModel | null, position: Monaco.Position): boolean {
    if (!model) { return false }
    const reference = Endge.source.referenceAt(
      options.sourceKind,
      languageContext(model.getValue(), position),
    )
    if (!reference) { return false }
    if (reference.target === 'type') {
      const type = typeCatalog().find(item => item.identity === reference.identity)
      if (!type || type.category !== 'user') { return false }
    }
    EndgeIDE.tabs.openSourceReference(reference)
    return true
  }
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
  if (configured?.syntax === syntax) { return }
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
  if (kind === 'property') { return monaco.languages.CompletionItemKind.Property }
  if (kind === 'value') { return monaco.languages.CompletionItemKind.Value }
  if (kind === 'keyword') { return monaco.languages.CompletionItemKind.Keyword }
  if (kind === 'snippet') { return monaco.languages.CompletionItemKind.Snippet }
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
