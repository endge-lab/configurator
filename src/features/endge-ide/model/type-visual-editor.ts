/* eslint-disable style/max-statements-per-line */
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

/** Parses canonical Type Source into the small semantic document consumed by the visual editor. */
export function parseTypeVisualSource(source: string): TypeVisualParseResult {
  const result = Endge.source.compile('type', source)
  const diagnostics = (result.diagnostics ?? []) as ProgramDiagnostic[]
  return {
    document: (result.document as TypeSourceDocument | undefined) ?? null,
    diagnostics,
    valid: result.ok && !diagnostics.some(item => item.severity === 'error') && result.document != null,
  }
}

/** Creates a detached editor copy. Type Source v1 documents contain JSON-compatible values only. */
export function cloneTypeSourceDocument(document: TypeSourceDocument): TypeSourceDocument {
  return JSON.parse(JSON.stringify(document)) as TypeSourceDocument
}

/** Serializes the semantic authoring document into deterministic Type Source v1. */
export function serializeTypeSourceDocument(document: TypeSourceDocument): string {
  return serializeCoreTypeSourceDocument(document)
}

export function createDefaultTypeSourceDocument(kind: TypeVisualRootKind): TypeSourceDocument {
  if (kind === 'object') { return { definition: { kind: 'object', fields: [createDefaultTypeSourceField('field')] } } }
  if (kind === 'enum') { return { definition: { kind: 'enum', values: ['value'] } } }
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
