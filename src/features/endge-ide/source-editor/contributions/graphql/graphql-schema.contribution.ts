import type * as Monaco from 'monaco-editor'
import type { EndgeIDEGraphQLSchema_Module } from '@/features/endge-ide/modules/graphql-schema/EndgeIDEGraphQLSchema_Module'
import type { GraphQLCompletionKind } from '@/features/endge-ide/services/graphql-schema/graphql-schema-completions'
import type { GraphQLSchemaSourceKind, GraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'

import { Endge } from '@endge/core'
import { watch } from 'vue'

import { completeGraphQLDocument } from '@/features/endge-ide/services/graphql-schema/graphql-schema-completions'
import { GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE, validateGraphQLSourceTemplates } from '@/features/endge-ide/services/graphql-schema/graphql-schema-diagnostics'
import { resolveGraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'
import {
  findGraphQLSourceTemplates,
  findGraphQLTemplateAt,
  toGraphQLOffset,
} from '@/features/endge-ide/services/graphql-schema/graphql-template-locator'

const MARKER_OWNER = 'endge-graphql-schema'
let contributionSequence = 0

export interface GraphQLSchemaContributionOptions {
  sourceKind: GraphQLSchemaSourceKind
  schemas: () => EndgeIDEGraphQLSchema_Module
}

/**
 * Подключает к Source Query/Stream проверку gql-документа по сохранённой схеме и автодополнение.
 * Маркеры компилятора остаются у адаптера Source; схемные маркеры имеют собственный owner и source.
 */
export function createGraphQLSchemaContribution(options: GraphQLSchemaContributionOptions): ScriptEditorExtension {
  const instanceId = ++contributionSequence

  return {
    id: `${MARKER_OWNER}.${instanceId}`,
    // Внутри gql`...` подсказки DSL Source не относятся к GraphQL-документу.
    suppressesSourceCompletions: (model, offset) => findGraphQLTemplateAt(findGraphQLSourceTemplates(model.getValue()), offset) !== null,
    install: ({ monaco, model }) => {
      let refreshTimer: ReturnType<typeof setTimeout> | null = null

      // Endpoint зависит только от текста: компиляция Source выполняется один раз на версию модели.
      let targetCache: { version: number, target: GraphQLSchemaTarget | null } | null = null
      const currentEntry = () => {
        const version = model.getVersionId()
        if (targetCache?.version !== version) {
          targetCache = { version, target: resolveGraphQLSchemaTarget(Endge.source, options.sourceKind, model.getValue()) }
        }
        return options.schemas().entryFor(targetCache.target)
      }

      const refresh = (): void => {
        if (model.isDisposed()) {
          return
        }
        const entry = currentEntry()
        const diagnostics = entry
          ? validateGraphQLSourceTemplates(entry.schema, model.getValue())
          : []
        monaco.editor.setModelMarkers(model, MARKER_OWNER, diagnostics.map((diagnostic) => {
          const start = model.getPositionAt(diagnostic.start)
          const end = model.getPositionAt(diagnostic.end)
          return {
            severity: diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            source: GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE,
            code: diagnostic.code,
            message: diagnostic.message,
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
          }
        }))
      }

      const scheduleRefresh = (): void => {
        if (refreshTimer) {
          clearTimeout(refreshTimer)
        }
        refreshTimer = setTimeout(() => {
          refreshTimer = null
          refresh()
        }, 150)
      }

      const contentListener = model.onDidChangeContent(scheduleRefresh)
      const stopSchemaWatch = watch(() => options.schemas().revision.value, scheduleRefresh)
      const completionProvider = monaco.languages.registerCompletionItemProvider(model.getLanguageId(), {
        triggerCharacters: ['{', '(', ':', '$', '@', ' '],
        provideCompletionItems(completionModel, position) {
          if (completionModel !== model) {
            return { suggestions: [] }
          }
          const offset = model.getOffsetAt(position)
          const template = findGraphQLTemplateAt(findGraphQLSourceTemplates(model.getValue()), offset)
          const entry = template ? currentEntry() : null
          if (!template || !entry) {
            return { suggestions: [] }
          }
          const word = model.getWordUntilPosition(position)
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
          const suggestions = completeGraphQLDocument(entry.schema, template.text, toGraphQLOffset(template, offset))
            .map(item => ({
              label: item.label,
              kind: completionKind(monaco, item.kind),
              insertText: item.insertText,
              detail: item.detail,
              documentation: item.documentation,
              tags: item.deprecated ? [monaco.languages.CompletionItemTag.Deprecated] : undefined,
              range,
            }))
          return { suggestions }
        },
      })
      refresh()

      return {
        dispose() {
          if (refreshTimer) {
            clearTimeout(refreshTimer)
          }
          contentListener.dispose()
          completionProvider.dispose()
          stopSchemaWatch()
          if (!model.isDisposed()) {
            monaco.editor.setModelMarkers(model, MARKER_OWNER, [])
          }
        },
      }
    },
  }
}

function completionKind(monaco: typeof Monaco, kind: GraphQLCompletionKind): Monaco.languages.CompletionItemKind {
  switch (kind) {
    case 'field':
      return monaco.languages.CompletionItemKind.Field
    case 'argument':
      return monaco.languages.CompletionItemKind.Property
    case 'type':
      return monaco.languages.CompletionItemKind.Class
    case 'enumValue':
      return monaco.languages.CompletionItemKind.EnumMember
    case 'variable':
      return monaco.languages.CompletionItemKind.Variable
    case 'directive':
      return monaco.languages.CompletionItemKind.Function
    default:
      return monaco.languages.CompletionItemKind.Keyword
  }
}
