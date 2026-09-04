import type {
  ComponentSFCPropsVisualProjection,
  RComponentSFC_IR_Prop,
  TypeSourceDocument,
  TypeSourceExpression,
  TypeSourceField,
} from '@endge/core'

/** Строит временный документ схемы. Каноническим значением остаётся defineProps в Source SFC. */
export function componentSFCPropsToVisualDocument(
  projection: ComponentSFCPropsVisualProjection,
): TypeSourceDocument {
  return {
    definition: {
      kind: 'object',
      fields: projection.props.map(propToVisualField),
    },
  }
}

/** Преобразует визуальную проекцию обратно в плоский публичный контракт props компилятора. */
export function visualDocumentToComponentSFCProps(
  document: TypeSourceDocument,
): RComponentSFC_IR_Prop[] {
  if (document.definition.kind !== 'object') {
    return []
  }

  return document.definition.fields.map(field => ({
    name: field.key,
    type: visualExpressionToTypeScript(field.type),
    isArray: field.array,
    optional: field.optional,
  }))
}

export function collectComponentSFCPropTypeIdentities(
  projection: ComponentSFCPropsVisualProjection,
): string[] {
  return [...new Set(projection.props.map(prop => unwrapArrayType(prop.type, prop.isArray === true).type))]
    .filter(Boolean)
}

function propToVisualField(prop: RComponentSFC_IR_Prop): TypeSourceField {
  const unwrapped = unwrapArrayType(prop.type, prop.isArray === true)
  return {
    key: prop.name,
    type: { kind: 'reference', identity: unwrapped.type || 'unknown' },
    optional: prop.optional === true,
    array: unwrapped.array,
    examples: [],
  }
}

function unwrapArrayType(rawType: string, arrayHint: boolean): { type: string, array: boolean } {
  const type = rawType.trim()
  const generic = type.match(/^Array<([\s\S]+)>$/)
  if (generic) {
    return { type: generic[1]!.trim(), array: true }
  }
  if (type.endsWith('[]')) {
    const item = type.slice(0, -2).trim()
    return {
      type: item.startsWith('(') && item.endsWith(')') ? item.slice(1, -1).trim() : item,
      array: true,
    }
  }
  return { type: type || 'unknown', array: arrayHint }
}

function visualExpressionToTypeScript(expression: TypeSourceExpression): string {
  if (expression.kind === 'reference') {
    return expression.identity.trim() || 'unknown'
  }
  if (expression.kind === 'object') {
    if (expression.fields.length === 0) {
      return '{}'
    }
    const fields = expression.fields.map((field) => {
      const name = /^[A-Z_$][\w$]*$/i.test(field.key) ? field.key : JSON.stringify(field.key)
      const type = visualExpressionToTypeScript(field.type)
      const value = field.array ? `${parenthesizeArrayType(type)}[]` : type
      return `${name}${field.optional ? '?' : ''}: ${value}`
    })
    return `{ ${fields.join('; ')} }`
  }
  if (expression.kind === 'enum') {
    return expression.values.map(value => JSON.stringify(value)).join(' | ') || 'never'
  }
  if (expression.kind === 'union') {
    return expression.variants.map(visualExpressionToTypeScript).join(' | ') || 'never'
  }
  if (expression.kind === 'record') {
    return `Record<string, ${visualExpressionToTypeScript(expression.values)}>`
  }
  return `${parenthesizeArrayType(visualExpressionToTypeScript(expression.items))}[]`
}

function parenthesizeArrayType(type: string): string {
  return type.includes('|') || type.includes('&') || type.includes('=>') ? `(${type})` : type
}
