import type { TypeSourceExpression } from '@endge/core'

export type ConfigValueEditorKind = 'string' | 'number' | 'boolean' | 'enum' | 'time' | 'datetime' | 'trigger-set' | 'json' | 'array' | 'object' | 'record' | 'union'

/** Single dispatch registry for source defaults and effective context values. */
export function resolveConfigValueEditor(type: TypeSourceExpression): ConfigValueEditorKind {
  if (type.kind === 'enum') return 'enum'
  if (type.kind === 'array') return 'array'
  if (type.kind === 'object') return 'object'
  if (type.kind === 'record') return 'record'
  if (type.kind === 'union') return 'union'
  if (type.kind !== 'reference') return 'json'
  switch (type.identity) {
    case 'String': case 'ID': return 'string'
    case 'Number': return 'number'
    case 'Boolean': return 'boolean'
    case 'Time': return 'time'
    case 'DateTime': return 'datetime'
    case 'TriggerSet': return 'trigger-set'
    default: return 'json'
  }
}
