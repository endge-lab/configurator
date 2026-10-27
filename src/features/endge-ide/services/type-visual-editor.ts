import type {
  ProgramDiagnostic,
  TypeSourceDefinition,
  TypeSourceDocument,
  TypeSourceField,
} from '@endge/core'

import { Endge, serializeTypeSourceDocument as serializeCoreTypeSourceDocument } from '@endge/core'

export type TypeVisualRootKind = TypeSourceDefinition['kind']

export interface TypeVisualParseResult {
  document: TypeSourceDocument | null
  diagnostics: ProgramDiagnostic[]
  valid: boolean
}

// Разбирает канонический Type Source в компактный семантический документ визуального редактора.
// Документ хранит только выбранную ветку contextSwitch, поэтому визуальное сохранение
// схлопнуло бы остальные ветки; такой Type редактируется только в режиме Source.
export function parseTypeVisualSource(source: string): TypeVisualParseResult {
  const result = Endge.source.compile('type', source)
  const diagnostics = (result.diagnostics ?? []) as ProgramDiagnostic[]
  const document = (result.document as TypeSourceDocument | undefined) ?? null
  if (document && containsContextVariants(document.definition)) {
    return {
      document,
      diagnostics: [...diagnostics, {
        severity: 'error',
        code: 'type-visual-context-switch',
        message: 'Визуальный редактор не показывает варианты contextSwitch: редактируйте этот Type в режиме Source.',
        sourcePath: 'definition',
      } as ProgramDiagnostic],
      valid: false,
    }
  }
  return {
    document,
    diagnostics,
    valid: result.ok && !diagnostics.some(item => item.severity === 'error') && result.document != null,
  }
}

function containsContextVariants(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsContextVariants)
  }
  if (value == null || typeof value !== 'object') {
    return false
  }
  return Object.entries(value).some(([key, item]) => (key === 'contextVariants' && Array.isArray(item) && item.length > 0) || containsContextVariants(item))
}

// Создаёт независимую копию редактора. Документы Type Source v1 содержат только JSON-совместимые значения.
export function cloneTypeSourceDocument(document: TypeSourceDocument): TypeSourceDocument {
  return JSON.parse(JSON.stringify(document)) as TypeSourceDocument
}

// Сериализует семантический authoring-документ в детерминированный Type Source v1.
export function serializeTypeSourceDocument(document: TypeSourceDocument): string {
  return serializeCoreTypeSourceDocument(document)
}

export function createDefaultTypeSourceDocument(kind: TypeVisualRootKind): TypeSourceDocument {
  if (kind === 'object') {
    return { definition: { kind: 'object', fields: [createDefaultTypeSourceField('field')] } }
  }
  if (kind === 'enum') {
    return { definition: { kind: 'enum', values: ['value'] } }
  }
  if (kind === 'union') {
    return {
      definition: {
        kind: 'union',
        variants: [
          { kind: 'reference', identity: 'String' },
          { kind: 'reference', identity: 'Number' },
        ],
      },
    }
  }
  return {
    definition: {
      kind: 'array',
      items: { kind: 'reference', identity: 'String' },
    },
  }
}

export function createDefaultTypeSourceField(key: string): TypeSourceField {
  return {
    key,
    type: { kind: 'reference', identity: 'String' },
    optional: false,
    array: false,
    examples: [],
  }
}

// Authored definition Type по identity: undefined — Type не найден или Source не разобран,
// null — Type без структуры (примитив).
export type TypeVisualDefinitionLookup = (identity: string) => TypeSourceDefinition | null | undefined

export interface TypeVisualExtendsResult {
  // Definition с развёрнутой цепочкой extends: унаследованные поля первыми (с inheritedFrom),
  // собственное поле с тем же именем заменяет унаследованное на его месте — как в компиляторе core.
  definition: TypeSourceDefinition
  // Прямой базовый Type или null, если у definition нет extends.
  base: string | null
  // Identity Type из цепочки, который не удалось найти или разобрать.
  missingBase: string | null
  // Цикл наследования или не-object база; поля базы тогда не показываются.
  invalidBase: 'cycle' | 'not-object' | null
}

/**
 * Разворачивает `extends` для отображения в визуальном редакторе. Authored document при этом не
 * меняется: визуальное сохранение сериализует только собственные поля и сохраняет `extends`.
 */
export function resolveTypeVisualExtends(
  definition: TypeSourceDefinition,
  lookup: TypeVisualDefinitionLookup,
  identity?: string,
): TypeVisualExtendsResult {
  const state: Pick<TypeVisualExtendsResult, 'missingBase' | 'invalidBase'> = { missingBase: null, invalidBase: null }
  const base = definition.kind === 'object' ? definition.extends?.identity ?? null : null
  const flattened = flattenTypeVisualDefinition(definition, identity ? [identity] : [], lookup, state)
  return { definition: flattened, base, ...state }
}

function flattenTypeVisualDefinition(
  definition: TypeSourceDefinition,
  chain: readonly string[],
  lookup: TypeVisualDefinitionLookup,
  state: Pick<TypeVisualExtendsResult, 'missingBase' | 'invalidBase'>,
): TypeSourceDefinition {
  if (definition.kind !== 'object' || !definition.extends) {
    return definition
  }
  const base = definition.extends.identity
  if (chain.includes(base)) {
    state.invalidBase ??= 'cycle'
    return definition
  }
  const baseDefinition = lookup(base)
  if (baseDefinition === undefined) {
    state.missingBase ??= base
    return definition
  }
  const flatBase = baseDefinition ? flattenTypeVisualDefinition(baseDefinition, [...chain, base], lookup, state) : null
  if (flatBase?.kind !== 'object') {
    state.invalidBase ??= 'not-object'
    return definition
  }
  const fields: TypeSourceField[] = flatBase.fields.map(field => ({ ...field, inheritedFrom: field.inheritedFrom ?? base }))
  const positions = new Map(fields.map((field, index) => [field.key, index]))
  for (const field of definition.fields) {
    const index = positions.get(field.key)
    if (index == null) {
      fields.push(field)
    }
    else {
      fields[index] = field
    }
  }
  return { ...definition, fields }
}
