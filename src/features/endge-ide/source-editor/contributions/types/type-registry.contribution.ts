/* eslint-disable style/max-statements-per-line */
import type { ScriptEditorExtension } from '@/features/endge-ide/source-editor/adapters/monaco/script-editor-extension.types'

import { compileComponentSFC, Endge } from '@endge/core'
import { toast } from 'vue-sonner'

import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { resolveEndgeTypeDefinition } from '@/features/endge-ide/model/types/type-definition-resolver'
import { installMonacoReferenceNavigation } from '@/features/endge-ide/source-editor/adapters/monaco/install-monaco-reference-navigation'
import { resolveComponentSFCTagReference } from '@/features/endge-ide/source-editor/contributions/component-sfc/component-tag-reference'

const BUILTINS = new Set([
  'Array',
  'Boolean',
  'Date',
  'DateTime',
  'ID',
  'Null',
  'Number',
  'Object',
  'Record',
  'String',
  'Time',
  'Any',
  'Promise',
  'Readonly',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'unknown',
  'never',
  'void',
  'null',
  'undefined',
  'string',
  'number',
  'boolean',
  'object',
  'any',
  'true',
  'false',
])

/** Type Registry completion, hover, navigation and live diagnostics for SFC Monaco. */
export function createTypeRegistryContribution(): ScriptEditorExtension {
  return {
    id: 'types:registry',
    install({ monaco, editor, model }) {
      const catalog = () => {
        const compiled = Endge.program.getTypeCatalog()
        const compiledIdentities = new Set(compiled.map(type => type.identity))
        const domainFallback = Endge.domain.getTypes()
          .filter(type => !compiledIdentities.has(type.identity))
          .map(type => ({
            id: type.id,
            identity: type.identity,
            displayName: type.displayName || type.name || type.identity,
            category: type.meta?.primitiveKind === 'reference'
              ? 'reference' as const
              : type.isPrimitive
                ? 'primitive' as const
                : 'user' as const,
            sourceVersion: Number(type.sourceVersion ?? 1) || 1,
            definition: null,
            status: 'valid' as const,
          }))
        return [...compiled, ...domainFallback]
      }

      const validate = () => {
        const source = model.getValue()
        const result = compileComponentSFC(source, {
          resolveTypeDefinition: resolveEndgeTypeDefinition,
        })
        const expressions = [
          result.ast?.script?.props?.source,
          ...result.contract.inputs.map(input => input.type),
          ...(result.ir?.script.ports.require.computations.flatMap(port => [port.inputType, port.outputType]) ?? []),
          ...(result.ir?.script.ports.require.actions.flatMap(port => [port.inputType, port.outputType]) ?? []),
          ...(result.ir?.script.ports.require.components.map(port => port.propsType) ?? []),
          ...(result.ir?.script.ports.provides.actions.flatMap(port => [port.inputType, port.outputType]) ?? []),
          ...(result.ir?.script.ports.emits.events.map(port => port.payloadType) ?? []),
        ]
        const known = new Set([
          ...catalog().map(type => type.identity),
          ...localTypeDeclarations(source),
        ])
        const markers: import('monaco-editor').editor.IMarkerData[] = []
        for (const expression of expressions.filter((expression): expression is string => Boolean(expression))) {
          for (const match of String(expression).matchAll(/\b[A-Z_$][\w$]*\b/gi)) {
            const identity = match[0]
            if (identity === 'Any' || identity === 'any') {
              markers.push(markerForIdentity(source, identity, 'Any disables strict type checking.', false))
            }
            else if (/^[A-Z]/.test(identity) && !BUILTINS.has(identity) && !known.has(identity)) {
              markers.push(markerForIdentity(source, identity, `Type "${identity}" is missing from Type Registry.`, true))
            }
          }
        }
        monaco.editor.setModelMarkers(model, 'endge-type-registry', markers)
      }

      const completion = monaco.languages.registerCompletionItemProvider('html', {
        triggerCharacters: [':', '<', '|'],
        provideCompletionItems(currentModel, position) {
          if (currentModel !== model || !isInsideScript(model.getValue(), model.getOffsetAt(position))) { return { suggestions: [] } }
          const word = model.getWordUntilPosition(position)
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
          return {
            suggestions: catalog().map(type => ({
              label: type.identity,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: type.identity,
              detail: `${type.category} type · ${type.displayName}`,
              range,
            })),
          }
        },
      })
      const hover = monaco.languages.registerHoverProvider('html', {
        provideHover(currentModel, position) {
          if (currentModel !== model) { return null }
          const componentReference = resolveComponentSFCTagReference(
            model.getValue(),
            model.getOffsetAt(position),
          )
          if (componentReference) {
            const component = Endge.domain.getComponentSFC(componentReference.identity)
            return {
              range: monaco.Range.fromPositions(
                model.getPositionAt(componentReference.range.start),
                model.getPositionAt(componentReference.range.end),
              ),
              contents: [
                { value: `**${component?.tag?.trim() || componentReference.identity}**` },
                { value: `Component · ${component?.displayName || component?.name || componentReference.identity}` },
                { value: 'Cmd/Ctrl + click — open Component Source' },
              ],
            }
          }
          const word = model.getWordAtPosition(position)?.word
          if (word && localTypeDeclarations(model.getValue()).has(word)) { return null }
          const type = word ? catalog().find(item => item.identity === word) : null
          if (!type) { return null }
          return {
            contents: [
              { value: `**${type.identity}**` },
              { value: `${type.category} type · ${type.displayName}` },
              ...(type.category === 'user' ? [{ value: 'Cmd/Ctrl + click — open Type Source' }] : []),
            ],
          }
        },
      })
      const navigation = installMonacoReferenceNavigation({
        monaco,
        editor,
        actionId: 'endge.open-sfc-reference',
        openAt(position) {
          const componentReference = resolveComponentSFCTagReference(
            model.getValue(),
            model.getOffsetAt(position),
          )
          if (componentReference) {
            return EndgeIDE.tabs.openSourceReference(componentReference)
          }
          const identity = model.getWordAtPosition(position)?.word
          if (identity && localTypeDeclarations(model.getValue()).has(identity)) { return false }
          const type = identity ? catalog().find(item => item.identity === identity) : null
          if (!type || type.category !== 'user') { return false }
          return EndgeIDE.tabs.openSourceReference({ target: 'type', identity: type.identity, range: { start: 0, end: 0 } })
        },
        onMissing: () => toast.info('Под курсором нет ссылки на документ'),
      })
      let validateTimer: ReturnType<typeof setTimeout> | null = null
      const content = model.onDidChangeContent(() => {
        if (validateTimer) { clearTimeout(validateTimer) }
        validateTimer = setTimeout(() => {
          validateTimer = null
          validate()
        }, 120)
      })
      validate()
      return {
        dispose() {
          if (validateTimer) { clearTimeout(validateTimer) }
          monaco.editor.setModelMarkers(model, 'endge-type-registry', [])
          completion.dispose()
          hover.dispose()
          navigation.dispose()
          content.dispose()
        },
      }

      function markerForIdentity(source: string, identity: string, message: string, error: boolean) {
        const start = Math.max(0, source.indexOf(identity))
        const startPosition = model.getPositionAt(start)
        const endPosition = model.getPositionAt(start + identity.length)
        return {
          severity: error ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          message,
          startLineNumber: startPosition.lineNumber,
          startColumn: startPosition.column,
          endLineNumber: endPosition.lineNumber,
          endColumn: endPosition.column,
        }
      }
    },
  }
}

function isInsideScript(source: string, offset: number): boolean {
  const opening = source.lastIndexOf('<script', offset)
  const closing = source.lastIndexOf('</script>', offset)
  return opening >= 0 && opening > closing
}

function localTypeDeclarations(source: string): Set<string> {
  const identities = new Set<string>()
  for (const match of source.matchAll(/\b(?:interface|type|class|enum)\s+([A-Za-z_$][\w$]*)/g)) {
    if (match[1]) { identities.add(match[1]) }
  }
  return identities
}
