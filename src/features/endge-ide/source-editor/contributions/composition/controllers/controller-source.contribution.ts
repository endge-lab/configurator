import type { ControllerDefinition } from '@endge/core'
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'
import { getControllerCatalogDefinitions, resolveControllerCatalogDefinition } from '@/features/endge-ide/services/controllers/controller-catalog'

export function controllerSourceHint(definition: ControllerDefinition): string {
  const fields = (items: ControllerDefinition['contract']['props']) =>
    items
      .map(
        item =>
          `${item.key}${item.optional ? '?' : ''}: ${item.type}${item.array ? '[]' : ''}`,
      )
      .join(', ') || '—'
  return [
    `**${definition.displayName}** · runtime-only · read-only`,
    `Identity: \`${definition.identity}\``,
    `Origin: \`${JSON.stringify(definition.origin)}\``,
    `Provider required: \`${definition.defaultProviderKey}\``,
    `Props: ${fields(definition.contract.props)}`,
    `Outputs: ${fields(definition.contract.outputs)}`,
    `Commands: ${Object.keys(definition.contract.commands).join(', ') || '—'}`,
    `Dependencies: ${
      Object.entries(definition.contract.dependencies)
        .map(
          ([name, value]) =>
            `${name}: ${value.kind}${value.optional ? '?' : ''}`,
        )
        .join(', ') || '—'
    }`,
  ].join('\n\n')
}

// Registry-backed assistance; code-owned definitions never resolve as Domain documents.
export function createControllerSourceContribution(): ScriptEditorExtension {
  return {
    id: 'endge-composition-controllers',
    install: ({ monaco, model }) => {
      const completion = monaco.languages.registerCompletionItemProvider(
        model.getLanguageId(),
        {
          triggerCharacters: ['\'', '"'],
          provideCompletionItems(current, position) {
            if (
              current !== model
              || !/controller\(\s*['"][^'"]*$/.test(
                current
                  .getLineContent(position.lineNumber)
                  .slice(0, position.column - 1),
              )
            ) {
              return { suggestions: [] }
            }
            const prefix = /controller\(\s*['"]([^'"]*)$/.exec(current.getLineContent(position.lineNumber).slice(0, position.column - 1))?.[1] ?? ''
            return {
              suggestions: getControllerCatalogDefinitions()
                .map(definition => ({
                  label: definition.identity,
                  kind: monaco.languages.CompletionItemKind.Value,
                  insertText: definition.identity,
                  detail: `${definition.displayName} · code-owned Controller`,
                  documentation: { value: controllerSourceHint(definition) },
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column - prefix.length,
                    position.lineNumber,
                    position.column,
                  ),
                })),
            }
          },
        },
      )
      const hover = monaco.languages.registerHoverProvider(
        model.getLanguageId(),
        {
          provideHover(current, position) {
            if (current !== model) {
              return null
            }
            const line = current.getLineContent(position.lineNumber)
            for (const match of line.matchAll(
              /controller\(\s*['"]([^'"]+)['"]\s*\)/g,
            )) {
              const start = match.index ?? 0
              if (
                position.column - 1 < start
                || position.column - 1 > start + match[0].length
              ) {
                continue
              }
              const definition = resolveControllerCatalogDefinition(match[1]!)
              if (definition) {
                return {
                  contents: [{ value: controllerSourceHint(definition) }],
                }
              }
            }
            return null
          },
        },
      )
      return {
        dispose() {
          completion.dispose()
          hover.dispose()
        },
      }
    },
  }
}
