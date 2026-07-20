/* eslint-disable style/max-statements-per-line */
import type {
  ProgramDiagnostic,
  TypeSourceDefinition,
  TypeSourceDocument,
  TypeSourceExpression,
  TypeSourceField,
} from '@endge/core'

import { Endge } from '@endge/core'

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
  return `defineType(${serializeDefinition(document.definition)})\n`
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

function serializeDefinition(definition: TypeSourceDefinition): string {
  if (definition.kind === 'object') {
    return serializeObjectDefinition(definition, 0)
  }

  return serializeTypeExpression(definition, 0)
}

function serializeObjectDefinition(definition: Extract<TypeSourceDefinition, { kind: 'object' }>, indent: number): string {
  if (definition.fields.length === 0) { return '{}' }
  const fields = definition.fields.map(field => serializeField(field, indent + 2)).join(',\n\n')
  return `{\n${fields},\n${' '.repeat(indent)}}`
}

function serializeTypeExpression(expression: TypeSourceExpression, indent: number): string {
  if (expression.kind === 'reference') { return `type(${toSourceString(expression.identity)})` }
  if (expression.kind === 'object') { return `objectOf(${serializeObjectDefinition(expression, indent)})` }

  if (expression.kind === 'enum') {
    const itemIndent = ' '.repeat(indent + 2)
    const values = expression.values.map(value => `${itemIndent}${serializeStaticValue(value)},`).join('\n')
    return `enumOf([\n${values}\n${' '.repeat(indent)}])`
  }

  if (expression.kind === 'union') {
    const itemIndent = ' '.repeat(indent + 2)
    const variants = expression.variants
      .map(variant => `${itemIndent}${serializeTypeExpression(variant, indent + 2)},`)
      .join('\n')
    return `unionOf(\n${variants}\n${' '.repeat(indent)})`
  }

  return `arrayOf(\n${' '.repeat(indent + 2)}${serializeTypeExpression(expression.items, indent + 2)},\n${' '.repeat(indent)})`
}

function serializeField(field: TypeSourceField, indent: number): string {
  const prefix = ' '.repeat(indent)
  const modifierPrefix = ' '.repeat(indent + 2)
  const fieldType = field.type.kind === 'reference'
    ? toSourceString(field.type.identity)
    : serializeTypeExpression(field.type, indent)
  const lines = [`${prefix}${toSourcePropertyName(field.key)}: field(${fieldType})`]

  if (field.description != null && field.description !== '') { lines.push(`${modifierPrefix}.description(${toSourceString(field.description)})`) }
  if (field.min != null) { lines.push(`${modifierPrefix}.min(${serializeStaticValue(field.min)})`) }
  if (field.max != null) { lines.push(`${modifierPrefix}.max(${serializeStaticValue(field.max)})`) }
  for (const example of field.examples) { lines.push(`${modifierPrefix}.example(${serializeStaticValue(example)})`) }
  if (field.array) { lines.push(`${modifierPrefix}.array()`) }
  if (field.optional) { lines.push(`${modifierPrefix}.optional()`) }

  return lines.join('\n')
}

function serializeStaticValue(value: unknown): string {
  if (typeof value === 'string') { return toSourceString(value) }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) { return String(value) }
  if (Array.isArray(value)) { return `[${value.map(serializeStaticValue).join(', ')}]` }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${toSourcePropertyName(key)}: ${serializeStaticValue(nested)}`)
    return `{ ${entries.join(', ')} }`
  }
  return 'null'
}

function toSourcePropertyName(value: string): string {
  return /^[A-Z_$][\w$]*$/i.test(value) ? value : toSourceString(value)
}

function toSourceString(value: string): string {
  const json = JSON.stringify(value)
  return `'${json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, String.raw`\'`)}'`
}
