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

/** Разбирает канонический Type Source в компактный семантический документ визуального редактора. */
export function parseTypeVisualSource(source: string): TypeVisualParseResult {
  const result = Endge.source.compile('type', source)
  const diagnostics = (result.diagnostics ?? []) as ProgramDiagnostic[]
  return {
    document: (result.document as TypeSourceDocument | undefined) ?? null,
    diagnostics,
    valid: result.ok && !diagnostics.some(item => item.severity === 'error') && result.document != null,
  }
}

/** Создаёт независимую копию редактора. Документы Type Source v1 содержат только JSON-совместимые значения. */
export function cloneTypeSourceDocument(document: TypeSourceDocument): TypeSourceDocument {
  return JSON.parse(JSON.stringify(document)) as TypeSourceDocument
}

/** Сериализует семантический authoring-документ в детерминированный Type Source v1. */
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
