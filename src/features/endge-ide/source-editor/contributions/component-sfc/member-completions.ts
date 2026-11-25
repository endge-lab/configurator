import type {
  ComponentSFCPreviewProps,
  CompositionProgramPayload,
  RComponentSFC_AST_ElementNode,
  RComponentSFC_AST_Script,
  RComponentSFC_AST_TemplateNode,
  TypeSourceDefinition,
  TypeSourceExpression,
} from '@endge/core'
import type * as Monaco from 'monaco-editor'
import {
  analyzeComponentSFCScript,
  compositionCompletionTypes,
  computedCompletionType,
  Endge,
  parseComponentSFC,
  readCompletionType,
  sampleCompletionType,
  storeCompletionType,
  typeSourceExpressionToTypeScript,
} from '@endge/core'
import ts from 'typescript'
import standardLibrary from 'typescript/lib/lib.es5.d.ts?raw'

import { resolveEndgeTypeDefinition } from '@/features/endge-ide/services/types/type-definition-resolver'

const SOURCE_FILE = '/component.ts'
const LIB_FILE = '/lib.es5.d.ts'
const LIB_SNAPSHOT = ts.ScriptSnapshot.fromString(standardLibrary)
const IDENTIFIER = /^[A-Z_$][\w$]*$/i
const PRIMITIVE_TYPES = new Map([
  ['String', 'string'],
  ['Number', 'number'],
  ['Boolean', 'boolean'],
  ['Date', 'string'],
  ['Time', 'string'],
  ['DateTime', 'string'],
  ['Null', 'null'],
  ['Object', 'object'],
  ['Any', 'unknown'],
])

interface ComponentExpression {
  start: number
  source: string
}

export function createSFCMemberCompletions() {
  let snapshot = ts.ScriptSnapshot.fromString('')
  let currentSource = ''
  let version = 0
  const languageService = ts.createLanguageService({
    getCompilationSettings: () => ({ target: ts.ScriptTarget.ES2022, types: [], skipLibCheck: true }),
    getScriptFileNames: () => [SOURCE_FILE, LIB_FILE],
    getScriptVersion: file => file === SOURCE_FILE ? String(version) : '0',
    getScriptSnapshot: file => file === SOURCE_FILE ? snapshot : file === LIB_FILE ? LIB_SNAPSHOT : undefined,
    getCurrentDirectory: () => '/',
    getDefaultLibFileName: () => LIB_FILE,
    fileExists: file => file === SOURCE_FILE || file === LIB_FILE,
    readFile: file => file === SOURCE_FILE ? currentSource : file === LIB_FILE ? standardLibrary : undefined,
  })

  return {
    complete(
      monaco: typeof Monaco,
      model: Monaco.editor.ITextModel,
      offset: number,
      expression: ComponentExpression | undefined,
      ownerIdentity?: string,
    ): Monaco.languages.CompletionList | null {
      const source = model.getValue()
      if (!/\.[\w$]*$/.test(source.slice(0, offset))) {
        return null
      }
      const ast = parseComponentSFC(source).ast
      const script = ast?.script
      const inScript = script && offset >= script.range.start && offset <= script.range.end
      if (!inScript && !expression) {
        return null
      }

      const projection = projectComponentSource(script, ast?.template?.roots ?? [], offset, expression, ownerIdentity)
      if (currentSource !== projection.source) {
        currentSource = projection.source
        snapshot = ts.ScriptSnapshot.fromString(currentSource)
        version += 1
      }
      const completions = languageService.getCompletionsAtPosition(SOURCE_FILE, projection.offset, {
        includeCompletionsWithInsertText: true,
      })
      if (!completions?.isMemberCompletion) {
        return null
      }

      const prefixStart = offset - (source.slice(0, offset).match(/[\w$]*$/)?.[0].length ?? 0)
      const prefixEnd = offset + (source.slice(offset).match(/^[\w$]*/)?.[0].length ?? 0)
      const delta = offset - projection.offset
      return {
        suggestions: completions.entries.map((entry) => {
          // Monaco filters from the replacement start. Keep the typed dot outside
          // that range when TypeScript proposes changing it to an optional chain.
          const optionalMember = IDENTIFIER.test(entry.name) && entry.insertText === `?.${entry.name}`
          const span = optionalMember ? undefined : entry.replacementSpan ?? completions.optionalReplacementSpan
          const start = span && span.start + delta <= offset ? span.start + delta : prefixStart
          const projectedEnd = span ? span.start + span.length + delta : prefixEnd
          const end = Math.min(prefixEnd, Math.max(offset, projectedEnd))
          return {
            label: entry.name,
            insertText: optionalMember ? entry.name : entry.insertText ?? entry.name,
            filterText: optionalMember ? entry.name : entry.filterText,
            sortText: entry.sortText,
            kind: entry.kind === ts.ScriptElementKind.memberFunctionElement
              ? monaco.languages.CompletionItemKind.Method
              : monaco.languages.CompletionItemKind.Property,
            range: monaco.Range.fromPositions(model.getPositionAt(start), model.getPositionAt(end)),
          }
        }),
      }
    },
    dispose: () => languageService.dispose(),
  }
}

function projectComponentSource(
  script: RComponentSFC_AST_Script | null | undefined,
  template: RComponentSFC_AST_TemplateNode[],
  offset: number,
  expression: ComponentExpression | undefined,
  identity?: string,
): { source: string, offset: number } {
  const code = script?.content ?? ''
  const analysis = analyzeComponentSFCScript(script ?? null, { resolveTypeDefinition: resolveEndgeTypeDefinition })
  const bindings = new Set(analysis.locals.map(binding => binding.name))
  const tsScript = ts.createSourceFile(SOURCE_FILE, code, ts.ScriptTarget.Latest, true)
  const localTypes = new Set(tsScript.statements.flatMap(statement => (
    ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)
      ? statement.name?.text ?? []
      : []
  )))

  const typeCache = new Map<string, TypeSourceDefinition | null>()
  const resolveType = (name: string) => {
    if (!typeCache.has(name)) {
      typeCache.set(name, resolveEndgeTypeDefinition(name))
    }
    return typeCache.get(name)
  }
  const declaredTypes = new Map<string, string>()
  const referenceName = (name: string): string => {
    const primitive = PRIMITIVE_TYPES.get(name)
    if (primitive) {
      return primitive
    }
    if (!IDENTIFIER.test(name)) {
      return 'unknown'
    }
    if (localTypes.has(name)) {
      return name
    }

    const definition = resolveType(name)
    if (definition && !declaredTypes.has(name)) {
      declaredTypes.set(name, '')
      const own = typeSourceExpressionToTypeScript(definition, referenceName)
      const type = definition.kind === 'object' && definition.extends
        ? `${referenceName(definition.extends.identity)} & ${own}`
        : own
      declaredTypes.set(name, `type ${name} = ${type}`)
    }
    return name
  }

  const propsDeclaration = script?.props?.mode === 'type'
    ? script.props.source
    : (!script?.syntax ? findIncompleteScriptProps(tsScript) : undefined)
  const declaredProps = propsDeclaration || `{ ${analysis.props.map(prop =>
    `${JSON.stringify(prop.name)}${prop.optional ? '?' : ''}: ${prop.type}`,
  ).join('; ')} }`
  for (const match of `${code}\n${declaredProps}`.matchAll(/\b[A-Z_$][\w$]*\b/g)) {
    if (!localTypes.has(match[0]) && !PRIMITIVE_TYPES.has(match[0])) {
      referenceName(match[0])
    }
  }

  const runtimeTypes = collectRuntimePropTypes(identity, analysis.previewProps, resolveType)
  const runtimeProps = `{ ${[...runtimeTypes].map(([key, type]) =>
    `${JSON.stringify(key)}: ${typeSourceExpressionToTypeScript(computedCompletionType(type, resolveType), referenceName)}`,
  ).join('; ')} }`
  const propNames = new Set([...analysis.props.map(prop => prop.name), ...(expression ? runtimeTypes.keys() : [])])
  const props = [
    `type __EndgeDeclaredProps = ${declaredProps}`,
    `type __EndgeRuntimeProps = ${runtimeProps}`,
    'declare function defineProps<T = __EndgeDeclaredProps>(options?: unknown): T & __EndgeRuntimeProps',
    'declare function withDefaults<T>(props: T, defaults: unknown): T',
    'declare const __endgeProps: __EndgeDeclaredProps & __EndgeRuntimeProps',
    ...(!bindings.has('props') && !propNames.has('props') ? ['declare const props: typeof __endgeProps'] : []),
    ...[...propNames].filter(name => IDENTIFIER.test(name) && !bindings.has(name)).map(name =>
      `declare const ${name}: typeof __endgeProps[${JSON.stringify(name)}]`,
    ),
    ...declaredTypes.values(),
  ].join('\n')

  if (!expression) {
    const cursor = offset - (script?.range.start ?? 0)
    const before = code.slice(0, cursor)
    const after = code.slice(cursor)
    // A newline alone lets TypeScript read the next statement as the member name.
    const incompleteMember = before.endsWith('.') && /^[ \t]*[\r\n]/.test(after) ? '__endgeCompletion' : ''
    return { source: `${before}${incompleteMember}${after}\n${props}`, offset: cursor }
  }

  const scope = projectTemplateScope(template, offset)
  const start = `${code}\n${props}\n${scope.prefix}\nvoid (\n`
  return {
    source: `${start}${expression.source}\n)\n${scope.suffix}`,
    offset: start.length + offset - expression.start,
  }
}

// Babel rejects a dangling member access. TypeScript's recovery keeps earlier
// generic macro arguments available while the user is still typing.
function findIncompleteScriptProps(node: ts.Node): string | undefined {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineProps') {
    return node.typeArguments?.[0]?.getText()
  }
  return ts.forEachChild(node, findIncompleteScriptProps)
}

function collectRuntimePropTypes(
  identity: string | undefined,
  preview: ComponentSFCPreviewProps | null,
  resolveType: (identity: string) => TypeSourceDefinition | null | undefined,
): Map<string, TypeSourceExpression> {
  const types = new Map<string, TypeSourceExpression>()
  const set = (name: string, type: TypeSourceExpression | undefined, combine = false) => {
    if (!type || (type.kind === 'reference' && type.identity === 'Any')) {
      return
    }
    const current = types.get(name)
    if (!current) {
      types.set(name, type)
    }
    else if (combine) {
      types.set(name, { kind: 'union', variants: [...(current.kind === 'union' ? current.variants : [current]), type] })
    }
  }

  if (identity) {
    const sourceContext = Endge.source.currentSourceContext() ?? undefined
    for (const model of Endge.domain.getCompositions()) {
      if (!model.source.includes(identity)) {
        continue
      }
      const composition = Endge.program.getCompositionArtifact(model.identity)?.payload
        ?? Endge.source.compile('composition', model.source, { sourceContext }).artifact as CompositionProgramPayload | undefined
      const mounts = composition?.runtimes.filter(runtime => runtime.kind === 'component' && runtime.identity === identity)
      if (!composition || !mounts?.length) {
        continue
      }
      const bindings = compositionCompletionTypes(composition, resolveType)
      for (const mount of mounts) {
        for (const [name, binding] of Object.entries(mount.props)) {
          set(name, bindings.readBinding(binding), true)
        }
      }
    }
    for (const host of Endge.runtime.getRuntimeHostsByEntity('component-sfc', identity)) {
      for (const [name, value] of Object.entries(host.readInputs())) {
        if (value != null && (!Array.isArray(value) || value.length)) {
          set(name, sampleCompletionType(value))
        }
      }
    }
  }

  for (const [name, value] of Object.entries(preview ?? {})) {
    if (value && typeof value === 'object' && 'type' in value && value.type === 'data'
      && 'store' in value && typeof value.store === 'string' && 'path' in value && typeof value.path === 'string') {
      set(name, readCompletionType(storeCompletionType(value.store, resolveType), value.path, resolveType))
    }
    else if (!(value && typeof value === 'object' && 'type' in value && value.type === 'store')) {
      set(name, sampleCompletionType(value))
    }
  }
  return types
}

function projectTemplateScope(roots: RComponentSFC_AST_TemplateNode[], offset: number) {
  const scope: RComponentSFC_AST_ElementNode[] = []
  let nodes = roots
  for (;;) {
    const parent = nodes.find((node): node is RComponentSFC_AST_ElementNode =>
      node.kind === 'element' && offset >= node.range.start && offset < node.range.end,
    )
    if (!parent) {
      break
    }
    scope.push(parent)
    nodes = parent.children
  }

  const blocks: string[] = []
  for (const element of scope) {
    const loop = element.directives.find(directive =>
      directive.name === 'for' && !(offset >= directive.range.start && offset < directive.range.end),
    )
    const iterables = /^\s*(?:\(\s*([\w$]+)(?:\s*,\s*([\w$]+))?\s*\)|([\w$]+))\s+(?:in|of)\s+(\S[\s\S]*)$/.exec(loop?.expression ?? '')
    if (iterables) {
      const [, name, index, simpleName, items] = iterables
      const binding = name ?? simpleName
      if (IDENTIFIER.test(binding)) {
        blocks.push(`{ const __endgeItems = (${items}); { const ${binding} = __endgeItems[0]; ${index && IDENTIFIER.test(index) ? `const ${index} = 0;` : ''}`)
      }
    }

    if (element.tag.toLowerCase() === 'table' && element !== scope.at(-1)) {
      const rows = element.attributes.find(attribute => attribute.dynamic && (attribute.name === 'rows' || attribute.name === 'data'))?.value
      if (rows) {
        blocks.push(`{ const __endgeRows = (${rows}); { const row = __endgeRows[0]; const $row = { id: '', index: 0, data: row };`)
      }
    }
  }
  return { prefix: blocks.join('\n'), suffix: '}\n'.repeat(blocks.length * 2) }
}
