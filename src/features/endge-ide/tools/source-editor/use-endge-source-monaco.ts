/* eslint-disable style/max-statements-per-line */
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import type { SourceFormatLanguage } from '@/features/endge-ide/tools/format-source'
import type {
  SourceKind,
  SourceLanguageContext,
  SourceLanguageInlineHint,
  SourceLanguageSemanticHighlight,
  SourceLanguageSyntaxDefinition,
} from '@endge/core'
import type * as Monaco from 'monaco-editor'
import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { useUI } from '@endge/ui-vue'
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import { installMonacoReferenceNavigation } from '@/features/endge-ide/source-editor/adapters/monaco/install-monaco-reference-navigation'
import { formatSource } from '@/features/endge-ide/tools/format-source'
import { applyEndgeMonacoTheme, ENDGE_MONACO_SCROLLBAR_OPTIONS } from '@/features/endge-ide/tools/source-editor/editor-surface-theme'
import { usePersistedMonacoViewState } from '@/features/endge-ide/tools/source-editor/use-persisted-monaco-view-state'

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
  languageContext?: (source: string) => Partial<Omit<SourceLanguageContext, 'source' | 'position'>>
  refreshTriggers?: readonly SourceEditorRefreshTrigger[]
  formatLanguage?: SourceFormatLanguage
  onReady?: (editor: Monaco.editor.IStandaloneCodeEditor) => void
  extensions?: readonly ScriptEditorExtension[]
  viewStateKey?: string
  readOnly?: boolean
}

export type SourceEditorRefreshTrigger = (refresh: () => void) => () => void

/** Общий browser adapter Endge source language - Monaco. */
export function useEndgeSourceMonaco(options: UseEndgeSourceMonacoOptions) {
  const ui = useUI()
  const editor = shallowRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const diagnosticsCount = ref(0)
  const languageId = `endge-${options.sourceKind}-source`
  const viewState = usePersistedMonacoViewState(`monaco.${options.viewStateKey ?? options.sourceKind}`)
  const markerOwner = options.owner ?? languageId
  const languageStrategy = Endge.source.resolveLanguageStrategy(options.sourceKind)
  if (!languageStrategy) { throw new Error(`Source language strategy is not registered for "${options.sourceKind}".`) }
  const syntax = languageStrategy.syntax
  let completionDisposable: Monaco.IDisposable | null = null
  let contentDisposable: Monaco.IDisposable | null = null
  let referenceNavigationDisposable: Monaco.IDisposable | null = null
  let hoverDisposable: Monaco.IDisposable | null = null
  let signatureDisposable: Monaco.IDisposable | null = null
  let semanticHighlights: Monaco.editor.IEditorDecorationsCollection | null = null
  let inlineHints: Monaco.editor.IEditorDecorationsCollection | null = null
  let inlineHintsTimer: ReturnType<typeof setTimeout> | null = null
  let refreshTriggerDisposables: Array<() => void> = []
  let extensionDisposables: Monaco.IDisposable[] = []

  const typeCatalog = () => {
    const compiled = Endge.program.getTypeCatalog()
    const compiledIdentities = new Set(compiled.map(type => type.identity))
    const domainFallback = Endge.domain.getTypes()
      .filter(type => !compiledIdentities.has(type.identity))
      .map((type) => {
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
    return [...compiled, ...domainFallback]
  }

  const languageContext = (
    source: string,
    position?: Monaco.Position,
    includeExternal = false,
  ): SourceLanguageContext => {
    let external: Partial<Omit<SourceLanguageContext, 'source' | 'position'>> = {}
    if (includeExternal) {
      try {
        external = options.languageContext?.(source) ?? {}
      }
      catch (error) {
        console.warn(`[EndgeSourceMonaco] Language context is unavailable for "${options.sourceKind}".`, error)
      }
    }
    return {
      ...external,
      source,
      position: position ? { lineNumber: position.lineNumber, column: position.column } : undefined,
      ownerIdentity: options.ownerIdentity?.() ?? external.ownerIdentity,
      typeSymbols: typeCatalog().map(type => ({
        identity: type.identity,
        displayName: type.displayName,
        category: type.category,
        definition: type.definition,
        entityReference: type.entityReference,
      })),
    }
  }

  function refreshInlineHints(): void {
    const model = editor.value?.getModel()
    if (!model || !inlineHints) { return }
    try {
      inlineHints.set(
        Endge.source.inlineHints(options.sourceKind, languageContext(model.getValue(), undefined, true))
          .map(hint => toInlineHintDecoration(model, hint)),
      )
    }
    catch (error) {
      inlineHints.clear()
      console.warn(`[EndgeSourceMonaco] Inline hints are unavailable for "${options.sourceKind}".`, error)
    }
  }

  function scheduleInlineHints(): void {
    if (inlineHintsTimer) { clearTimeout(inlineHintsTimer) }
    inlineHintsTimer = setTimeout(() => {
      inlineHintsTimer = null
      refreshInlineHints()
    }, 120)
  }

  const validate = () => {
    const model = editor.value?.getModel()
    if (!model) { return }
    const context = languageContext(model.getValue())
    const diagnostics = (Endge.source.validate(options.sourceKind, model.getValue(), context).diagnostics ?? []) as EndgeSourceDiagnostic[]
    diagnosticsCount.value = diagnostics.length
    monaco.editor.setModelMarkers(model, markerOwner, diagnostics.map(item => toMarker(model, item)))
    semanticHighlights?.set(
      Endge.source.semanticHighlights(options.sourceKind, context)
        .map(item => toSemanticDecoration(model, item)),
    )
    scheduleInlineHints()
  }

  const setValue = (value: string) => {
    if (editor.value && editor.value.getValue() !== value) {
      editor.value.setValue(value)
      validate()
    }
  }

  const formatDocument = async (): Promise<void> => {
    const instance = editor.value
    const model = instance?.getModel()
    if (!instance || !model) { return }

    try {
      const formatted = await formatSource(
        Endge.source.normalize(options.sourceKind, model.getValue()),
        options.formatLanguage ?? 'typescript',
      )
      if (formatted === model.getValue()) { return }

      instance.pushUndoStop()
      instance.executeEdits('format-document', [{
        range: model.getFullModelRange(),
        text: formatted,
        forceMoveMarkers: true,
      }])
      instance.pushUndoStop()
    }
    catch (error) {
      toast.error('Не удалось форматировать source', {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  onMounted(() => {
    if (!options.container.value) { return }
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
    signatureDisposable = monaco.languages.registerSignatureHelpProvider(languageId, {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp(model, position) {
        const help = Endge.source.signatureHelp(options.sourceKind, languageContext(model.getValue(), position))
        if (!help) return null
        return {
          value: {
            activeSignature: help.activeSignature,
            activeParameter: help.activeParameter,
            signatures: help.signatures,
          },
          dispose() {},
        }
      },
    })
    editor.value = monaco.editor.create(options.container.value, {
      value: options.value(),
      language: languageId,
      theme: applyEndgeMonacoTheme(monaco, ui.value.isDark),
      minimap: { enabled: false },
      scrollbar: ENDGE_MONACO_SCROLLBAR_OPTIONS,
      automaticLayout: true,
      fontSize: 14,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      formatOnPaste: true,
      formatOnType: true,
      scrollBeyondLastLine: true,
      padding: { bottom: 10 },
      readOnly: options.readOnly === true,
    })
    viewState.attach(editor.value)
    semanticHighlights = editor.value.createDecorationsCollection()
    inlineHints = editor.value.createDecorationsCollection()
    refreshTriggerDisposables = (options.refreshTriggers ?? []).flatMap((trigger) => {
      try {
        return [trigger(scheduleInlineHints)]
      }
      catch (error) {
        console.warn(`[EndgeSourceMonaco] Inline hint refresh trigger is unavailable for "${options.sourceKind}".`, error)
        return []
      }
    })
    const editorModel = editor.value.getModel()
    if (editorModel) {
      extensionDisposables = (options.extensions ?? []).flatMap((extension) => {
        try {
          const disposable = extension.install({ monaco, editor: editor.value!, model: editorModel })
          return disposable ? [disposable] : []
        }
        catch (error) {
          console.error(`[EndgeSourceMonaco] Failed to install extension "${extension.id}": ${error instanceof Error ? error.message : String(error)}`)
          return []
        }
      })
    }
    referenceNavigationDisposable = installMonacoReferenceNavigation({
      monaco,
      editor: editor.value,
      actionId: 'endge.open-source-reference',
      openAt: position => openReference(editor.value?.getModel() ?? null, position),
      onMissing: () => toast.info('Под курсором нет ссылки на документ'),
    })
    hoverDisposable = monaco.languages.registerHoverProvider(languageId, {
      provideHover(model, position) {
        if (model !== editor.value?.getModel()) { return null }
        const reference = Endge.source.referenceAt(
          options.sourceKind,
          languageContext(model.getValue(), position),
        )
        if (!reference) { return null }
        const type = reference.target === 'type'
          ? typeCatalog().find(item => item.identity === reference.identity)
          : null
        if (reference.target === 'type' && !type) { return null }
        const isOpenableType = type?.category === 'user'
        return {
          range: monaco.Range.fromPositions(
            model.getPositionAt(reference.range.start),
            model.getPositionAt(reference.range.end),
          ),
          contents: type
            ? [
                { value: `**${type.identity}**` },
                { value: `${type.category} type · ${type.displayName}` },
                ...(isOpenableType ? [{ value: 'Cmd/Ctrl + click — open Type Source' }] : []),
              ]
            : [
                { value: `**${reference.identity}**` },
                { value: `${reference.target} document` },
                { value: 'Cmd/Ctrl + click — open document' },
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

  watch(
    () => ui.value.isDark,
    isDark => applyEndgeMonacoTheme(monaco, isDark),
  )

  onBeforeUnmount(() => {
    const model = editor.value?.getModel()
    viewState.detach()
    if (model) { monaco.editor.setModelMarkers(model, markerOwner, []) }
    if (inlineHintsTimer) { clearTimeout(inlineHintsTimer) }
    contentDisposable?.dispose()
    completionDisposable?.dispose()
    referenceNavigationDisposable?.dispose()
    hoverDisposable?.dispose()
    signatureDisposable?.dispose()
    refreshTriggerDisposables.forEach(dispose => dispose())
    refreshTriggerDisposables = []
    extensionDisposables.forEach(disposable => disposable.dispose())
    extensionDisposables = []
    semanticHighlights?.clear()
    semanticHighlights = null
    inlineHints?.clear()
    inlineHints = null
    editor.value?.dispose()
    model?.dispose()
    editor.value = null
  })

  return { editor, diagnosticsCount, setValue, validate, formatDocument, languageId }

  function openReference(model: Monaco.editor.ITextModel | null, position: Monaco.Position): boolean {
    if (!model) { return false }
    const reference = Endge.source.referenceAt(
      options.sourceKind,
      languageContext(model.getValue(), position, true),
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

function toSemanticDecoration(
  model: Monaco.editor.ITextModel,
  highlight: SourceLanguageSemanticHighlight,
): Monaco.editor.IModelDeltaDecoration {
  return {
    range: monaco.Range.fromPositions(
      model.getPositionAt(highlight.range.start),
      model.getPositionAt(highlight.range.end),
    ),
    options: {
      inlineClassName: highlight.status === 'resolved'
        ? 'endge-source-type-reference--resolved'
        : 'endge-source-type-reference--unresolved',
    },
  }
}

function toInlineHintDecoration(
  model: Monaco.editor.ITextModel,
  hint: SourceLanguageInlineHint,
): Monaco.editor.IModelDeltaDecoration {
  const length = model.getValueLength()
  const start = Math.max(0, Math.min(hint.range.start, length))
  const end = Math.max(start, Math.min(hint.range.end, length))
  return {
    range: monaco.Range.fromPositions(
      model.getPositionAt(start),
      model.getPositionAt(end),
    ),
    options: {
      hoverMessage: hint.tooltip ? { value: hint.tooltip } : undefined,
      after: {
        content: `  → ${hint.text}`,
        inlineClassName: hint.status === 'ambiguous'
          ? 'endge-source-inline-hint endge-source-inline-hint--ambiguous'
          : 'endge-source-inline-hint',
        inlineClassNameAffectsLetterSpacing: true,
        cursorStops: monaco.editor.InjectedTextCursorStops.None,
      },
    },
  }
}
