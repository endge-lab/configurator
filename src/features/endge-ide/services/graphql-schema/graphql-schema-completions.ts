import type { GraphQLSchemaLoadResult } from '@endge/core'

// Схема, построенная core (loadGraphQLSchema). Configurator не импортирует свой graphql:
// классы схемы различаются по Symbol.toStringTag, а не по instanceof другого экземпляра пакета.
export type GraphQLCompletionSchema = NonNullable<GraphQLSchemaLoadResult['schema']>

export type GraphQLCompletionKind
  = | 'field'
    | 'argument'
    | 'type'
    | 'enumValue'
    | 'keyword'
    | 'variable'
    | 'directive'

// Подсказка автодополнения GraphQL-документа, независимая от Monaco.
export interface GraphQLCompletionItem {
  label: string
  kind: GraphQLCompletionKind
  insertText: string
  detail?: string
  documentation?: string
  deprecated?: boolean
}

interface TypeRef {
  toString: () => string
}

interface NamedTypeRef extends TypeRef {
  name: string
  description?: string | null
}

interface ArgumentRef {
  name: string
  type: TypeRef
  description?: string | null
  deprecationReason?: string | null
}

interface FieldRef extends ArgumentRef {
  args?: readonly ArgumentRef[]
}

interface EnumValueRef {
  name: string
  description?: string | null
  deprecationReason?: string | null
}

interface DirectiveRef {
  name: string
  description?: string | null
  args: readonly ArgumentRef[]
}

type Frame
  = | { kind: 'selection', type: NamedTypeRef | null }
    | { kind: 'arguments', args: readonly ArgumentRef[], expect: 'name' | 'colon' | 'value', current: ArgumentRef | null }
    | { kind: 'inputObject', fields: Record<string, ArgumentRef>, expect: 'name' | 'colon' | 'value', current: ArgumentRef | null }
    | { kind: 'list', itemType: TypeRef | null }
    | { kind: 'variables', expect: 'variable' | 'type' | 'default' }

type Token
  = | { kind: 'name', value: string }
    | { kind: 'punct', value: string }
    | { kind: 'value' }

interface Tokenized {
  tokens: Token[]
  // Курсор внутри строки или комментария: автодополнение не выполняется.
  insideLiteral: boolean
}

type CompletionContext
  = | { kind: 'none' }
    | { kind: 'document' }
    | { kind: 'fields', type: NamedTypeRef | null }
    | { kind: 'typeCondition', parent: NamedTypeRef | null }
    | { kind: 'arguments', args: readonly ArgumentRef[], used: ReadonlySet<string> }
    | { kind: 'value', type: TypeRef | null }
    | { kind: 'inputTypes' }
    | { kind: 'variables' }
    | { kind: 'directives' }

const OPERATION_KEYWORDS = ['query', 'mutation', 'subscription', 'fragment'] as const
const PUNCTUATORS = new Set(['!', '$', '&', '(', ')', ':', '=', '@', '[', ']', '{', '|', '}'])

/**
 * Возвращает подсказки полей, аргументов, типов и значений для позиции GraphQL-текста.
 */
export function completeGraphQLDocument(
  schema: GraphQLCompletionSchema,
  text: string,
  cursor: number,
): GraphQLCompletionItem[] {
  const prefixText = text.slice(0, Math.max(0, Math.min(cursor, text.length)))
  const tokenized = tokenize(prefixText)
  if (tokenized.insideLiteral) {
    return []
  }
  const tokens = tokenized.tokens
  // Имя, которое пользователь сейчас набирает, не участвует в разборе контекста.
  if (/\w$/.test(prefixText) && tokens.at(-1)?.kind === 'name') {
    tokens.pop()
  }
  const analysis = analyze(schema, tokens)
  return itemsFor(schema, analysis.context, analysis.variables)
}

function itemsFor(
  schema: GraphQLCompletionSchema,
  context: CompletionContext,
  variables: ReadonlyMap<string, string>,
): GraphQLCompletionItem[] {
  switch (context.kind) {
    case 'document':
      return OPERATION_KEYWORDS.map(keyword => ({ label: keyword, kind: 'keyword', insertText: keyword }))
    case 'fields':
      return fieldItems(context.type)
    case 'typeCondition':
      return typeConditionItems(schema, context.parent)
    case 'arguments':
      return context.args
        .filter(arg => !context.used.has(arg.name))
        .map(arg => ({
          label: arg.name,
          kind: 'argument',
          insertText: `${arg.name}: `,
          detail: String(arg.type),
          documentation: arg.description ?? undefined,
          deprecated: Boolean(arg.deprecationReason),
        }))
    case 'value':
      return valueItems(context.type, variables)
    case 'inputTypes':
      return namedTypes(schema)
        .filter(type => isInputType(type))
        .map(type => typeItem(type))
    case 'variables':
      return [...variables.entries()].map(([name, type]) => ({
        label: name,
        kind: 'variable',
        insertText: name,
        detail: type,
      }))
    case 'directives':
      return directives(schema).map(directive => ({
        label: directive.name,
        kind: 'directive',
        insertText: directive.name,
        documentation: directive.description ?? undefined,
      }))
    default:
      return []
  }
}

function fieldItems(type: NamedTypeRef | null): GraphQLCompletionItem[] {
  if (!type) {
    return []
  }
  const typename: GraphQLCompletionItem = { label: '__typename', kind: 'field', insertText: '__typename', detail: 'String!' }
  if (!hasFields(type)) {
    return isUnion(type) ? [typename] : []
  }
  return [
    ...Object.values(fieldsOf(type)).map(field => ({
      label: field.name,
      kind: 'field' as const,
      insertText: field.name,
      detail: String(field.type),
      documentation: field.description ?? undefined,
      deprecated: Boolean(field.deprecationReason),
    })),
    typename,
  ]
}

function typeConditionItems(schema: GraphQLCompletionSchema, parent: NamedTypeRef | null): GraphQLCompletionItem[] {
  let candidates = namedTypes(schema).filter(type => hasTag(type, 'GraphQLObjectType', 'GraphQLInterfaceType', 'GraphQLUnionType'))
  if (parent && isUnion(parent)) {
    const members = new Set((parent as unknown as { getTypes: () => readonly NamedTypeRef[] }).getTypes().map(type => type.name))
    candidates = candidates.filter(type => members.has(type.name) || type.name === parent.name)
  }
  else if (parent && hasTag(parent, 'GraphQLInterfaceType')) {
    candidates = candidates.filter(type => type.name === parent.name || implementsInterface(type, parent.name))
  }
  return candidates.map(type => typeItem(type))
}

function valueItems(type: TypeRef | null, variables: ReadonlyMap<string, string>): GraphQLCompletionItem[] {
  const named = type ? namedTypeOf(type) : null
  const items: GraphQLCompletionItem[] = []
  if (named && hasTag(named, 'GraphQLEnumType')) {
    const values = (named as unknown as { getValues: () => readonly EnumValueRef[] }).getValues()
    items.push(...values.map(value => ({
      label: value.name,
      kind: 'enumValue' as const,
      insertText: value.name,
      detail: named.name,
      documentation: value.description ?? undefined,
      deprecated: Boolean(value.deprecationReason),
    })))
  }
  if (named?.name === 'Boolean') {
    items.push(
      { label: 'true', kind: 'keyword', insertText: 'true' },
      { label: 'false', kind: 'keyword', insertText: 'false' },
    )
  }
  for (const [name, variableType] of variables) {
    items.push({ label: `$${name}`, kind: 'variable', insertText: `$${name}`, detail: variableType })
  }
  return items
}

function typeItem(type: NamedTypeRef): GraphQLCompletionItem {
  return {
    label: type.name,
    kind: 'type',
    insertText: type.name,
    detail: typeKindLabel(type),
    documentation: type.description ?? undefined,
  }
}

// Однопроходный разбор префикса документа: стек selection/arguments/input-object.
function analyze(
  schema: GraphQLCompletionSchema,
  tokens: readonly Token[],
): { context: CompletionContext, variables: Map<string, string> } {
  const stack: Frame[] = []
  const variables = new Map<string, string>()
  const usedArguments: Array<Set<string>> = []
  // Отложенное состояние верхнего уровня и selection set.
  let rootType: NamedTypeRef | null = null
  let pendingField: FieldRef | null = null
  let pendingType: NamedTypeRef | null = null
  let pendingArgs: readonly ArgumentRef[] | null = null
  let mode: 'none' | 'operation' | 'fragmentName' | 'spread' | 'typeCondition' | 'directive' | 'variableName' = 'none'
  // После '...' следующий '{' открывает inline fragment, а не selection поля.
  let inlineFragment = false
  let variableName = ''
  let variableType = ''

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    const top = stack.at(-1)

    if (top?.kind === 'variables') {
      if (token.kind === 'punct' && token.value === ')') {
        recordVariable()
        stack.pop()
        continue
      }
      if (token.kind === 'punct' && token.value === '$') {
        recordVariable()
        top.expect = 'variable'
        mode = 'variableName'
        continue
      }
      if (mode === 'variableName' && token.kind === 'name') {
        variableName = token.value
        mode = 'none'
        continue
      }
      if (token.kind === 'punct' && token.value === ':') {
        top.expect = 'type'
        continue
      }
      if (token.kind === 'punct' && token.value === '=') {
        top.expect = 'default'
        continue
      }
      if (top.expect === 'type') {
        variableType += token.kind === 'name' || token.kind === 'punct' ? token.value : ''
      }
      continue
    }

    if (top?.kind === 'arguments' || top?.kind === 'inputObject') {
      if (token.kind === 'punct' && (token.value === ')' || token.value === '}')) {
        stack.pop()
        if (top.kind === 'arguments') {
          usedArguments.pop()
        }
        completeValueInParent(stack)
        continue
      }
      if (top.expect === 'name' && token.kind === 'name') {
        top.current = top.kind === 'arguments'
          ? top.args.find(arg => arg.name === token.value) ?? null
          : top.fields[token.value] ?? null
        if (top.kind === 'arguments') {
          usedArguments.at(-1)?.add(token.value)
        }
        top.expect = 'colon'
        continue
      }
      if (top.expect === 'colon' && token.kind === 'punct' && token.value === ':') {
        top.expect = 'value'
        continue
      }
      if (top.expect === 'value') {
        if (token.kind === 'punct' && token.value === '{') {
          stack.push({ kind: 'inputObject', fields: inputFieldsOf(top.current?.type ?? null), expect: 'name', current: null })
          continue
        }
        if (token.kind === 'punct' && token.value === '[') {
          stack.push({ kind: 'list', itemType: listItemType(top.current?.type ?? null) })
          continue
        }
        if (token.kind === 'punct' && token.value === '$') {
          continue
        }
        top.expect = 'name'
      }
      continue
    }

    if (top?.kind === 'list') {
      if (token.kind === 'punct' && token.value === ']') {
        stack.pop()
        completeValueInParent(stack)
        continue
      }
      if (token.kind === 'punct' && token.value === '{') {
        stack.push({ kind: 'inputObject', fields: inputFieldsOf(top.itemType), expect: 'name', current: null })
        continue
      }
      if (token.kind === 'punct' && token.value === '[') {
        stack.push({ kind: 'list', itemType: listItemType(top.itemType) })
      }
      continue
    }

    // Верхний уровень документа и selection set.
    if (token.kind === 'punct') {
      switch (token.value) {
        case '{': {
          const type = stack.length === 0
            ? (rootType ?? queryType(schema))
            : inlineFragment
              ? (pendingType ?? currentSelectionType(stack))
              : (pendingType ?? namedTypeOf(pendingField?.type ?? null))
          stack.push({ kind: 'selection', type })
          rootType = null
          resetPending()
          continue
        }
        case '}':
          stack.pop()
          resetPending()
          continue
        case '(':
          if (stack.length === 0 && pendingArgs === null) {
            stack.push({ kind: 'variables', expect: 'variable' })
            continue
          }
          stack.push({ kind: 'arguments', args: pendingArgs ?? [], expect: 'name', current: null })
          usedArguments.push(new Set())
          pendingArgs = null
          continue
        case ':':
          // Alias: следующее имя — настоящее поле.
          pendingField = null
          pendingArgs = null
          continue
        case '@':
          mode = 'directive'
          continue
        case '...':
          resetPending()
          mode = 'spread'
          inlineFragment = true
          continue
        default:
          continue
      }
    }

    if (token.kind !== 'name') {
      continue
    }

    if (stack.length === 0) {
      if (mode === 'typeCondition') {
        rootType = namedType(schema, token.value)
        mode = 'none'
      }
      else if (token.value === 'on' && mode === 'fragmentName') {
        mode = 'typeCondition'
      }
      else if (token.value === 'fragment') {
        mode = 'fragmentName'
      }
      else if (mode === 'directive') {
        pendingArgs = directive(schema, token.value)?.args ?? null
        mode = 'none'
      }
      else if (token.value === 'query' || token.value === 'mutation' || token.value === 'subscription') {
        rootType = operationType(schema, token.value)
        mode = 'operation'
      }
      continue
    }

    if (mode === 'directive') {
      pendingArgs = directive(schema, token.value)?.args ?? null
      mode = 'none'
      continue
    }
    if (mode === 'spread') {
      if (token.value === 'on') {
        mode = 'typeCondition'
      }
      else {
        // Именованный fragment spread не открывает selection set.
        mode = 'none'
        inlineFragment = false
      }
      continue
    }
    if (mode === 'typeCondition') {
      pendingType = namedType(schema, token.value)
      pendingField = null
      mode = 'none'
      continue
    }
    const parent = currentSelectionType(stack)
    inlineFragment = false
    pendingField = parent && hasFields(parent) ? fieldsOf(parent)[token.value] ?? null : null
    pendingType = null
    pendingArgs = pendingField?.args ?? null
  }

  return { context: contextAtEnd(), variables }

  function resetPending(): void {
    pendingField = null
    pendingType = null
    pendingArgs = null
    mode = 'none'
    inlineFragment = false
  }

  function recordVariable(): void {
    if (variableName) {
      variables.set(variableName, variableType)
    }
    variableName = ''
    variableType = ''
  }

  function contextAtEnd(): CompletionContext {
    const last = tokens.at(-1)
    const top = stack.at(-1)
    if (last?.kind === 'punct' && last.value === '@') {
      return { kind: 'directives' }
    }
    if (top?.kind === 'variables') {
      return top.expect === 'type' && !/[\w\]!]$/.test(variableType) ? { kind: 'inputTypes' } : { kind: 'none' }
    }
    if (top?.kind === 'arguments' || top?.kind === 'inputObject') {
      if (last?.kind === 'punct' && last.value === '$') {
        return { kind: 'variables' }
      }
      if (top.expect === 'value') {
        return { kind: 'value', type: top.current?.type ?? null }
      }
      if (top.expect === 'name') {
        return top.kind === 'arguments'
          ? { kind: 'arguments', args: top.args, used: usedArguments.at(-1) ?? new Set() }
          : { kind: 'arguments', args: Object.values(top.fields), used: new Set() }
      }
      return { kind: 'none' }
    }
    if (top?.kind === 'list') {
      return last?.kind === 'punct' && last.value === '$'
        ? { kind: 'variables' }
        : { kind: 'value', type: top.itemType }
    }
    if (mode === 'typeCondition') {
      return { kind: 'typeCondition', parent: stack.length === 0 ? null : currentSelectionType(stack) }
    }
    if (stack.length === 0) {
      return mode === 'none' && rootType === null ? { kind: 'document' } : { kind: 'none' }
    }
    if (mode === 'spread') {
      return { kind: 'none' }
    }
    return { kind: 'fields', type: currentSelectionType(stack) }
  }
}

// Значение аргумента/поля input завершено вложенным объектом или списком.
function completeValueInParent(stack: Frame[]): void {
  const parent = stack.at(-1)
  if (parent && (parent.kind === 'arguments' || parent.kind === 'inputObject') && parent.expect === 'value') {
    parent.expect = 'name'
  }
}

function currentSelectionType(stack: readonly Frame[]): NamedTypeRef | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const frame = stack[index]!
    if (frame.kind === 'selection') {
      return frame.type
    }
  }
  return null
}

function tokenize(text: string): Tokenized {
  const tokens: Token[] = []
  let index = 0
  while (index < text.length) {
    const char = text[index]!
    if (char === '#') {
      const end = text.indexOf('\n', index)
      if (end === -1) {
        return { tokens, insideLiteral: true }
      }
      index = end + 1
      continue
    }
    if (char === '"') {
      const block = text.startsWith('"""', index)
      const end = block ? findBlockStringEnd(text, index + 3) : findStringEnd(text, index + 1)
      if (end === -1) {
        return { tokens, insideLiteral: true }
      }
      tokens.push({ kind: 'value' })
      index = end
      continue
    }
    if (char === '.' && text.startsWith('...', index)) {
      tokens.push({ kind: 'punct', value: '...' })
      index += 3
      continue
    }
    if (PUNCTUATORS.has(char)) {
      tokens.push({ kind: 'punct', value: char })
      index += 1
      continue
    }
    if (/[_A-Z]/i.test(char)) {
      const match = /^[_A-Z]\w*/i.exec(text.slice(index))!
      tokens.push({ kind: 'name', value: match[0] })
      index += match[0].length
      continue
    }
    if (/[-0-9]/.test(char)) {
      const match = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(text.slice(index))
      tokens.push({ kind: 'value' })
      index += Math.max(1, match?.[0].length ?? 1)
      continue
    }
    index += 1
  }
  return { tokens, insideLiteral: false }
}

function findStringEnd(text: string, index: number): number {
  let cursor = index
  while (cursor < text.length) {
    const char = text[cursor]
    if (char === '\\') {
      cursor += 2
      continue
    }
    if (char === '"') {
      return cursor + 1
    }
    if (char === '\n') {
      return cursor
    }
    cursor += 1
  }
  return -1
}

function findBlockStringEnd(text: string, index: number): number {
  const end = text.indexOf('"""', index)
  return end === -1 ? -1 : end + 3
}

function namedTypes(schema: GraphQLCompletionSchema): NamedTypeRef[] {
  return Object.values(schema.getTypeMap() as unknown as Record<string, NamedTypeRef>)
    .filter(type => !type.name.startsWith('__'))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function namedType(schema: GraphQLCompletionSchema, name: string): NamedTypeRef | null {
  return (schema.getType(name) as unknown as NamedTypeRef | null | undefined) ?? null
}

function queryType(schema: GraphQLCompletionSchema): NamedTypeRef | null {
  return (schema.getQueryType() as unknown as NamedTypeRef | null | undefined) ?? null
}

function operationType(schema: GraphQLCompletionSchema, operation: 'query' | 'mutation' | 'subscription'): NamedTypeRef | null {
  const type = operation === 'query'
    ? schema.getQueryType()
    : operation === 'mutation'
      ? schema.getMutationType()
      : schema.getSubscriptionType()
  return (type as unknown as NamedTypeRef | null | undefined) ?? null
}

function directives(schema: GraphQLCompletionSchema): DirectiveRef[] {
  return [...(schema.getDirectives() as unknown as readonly DirectiveRef[])]
}

function directive(schema: GraphQLCompletionSchema, name: string): DirectiveRef | null {
  return directives(schema).find(item => item.name === name) ?? null
}

function namedTypeOf(type: TypeRef | null): NamedTypeRef | null {
  let current: unknown = type
  while (current && hasTag(current, 'GraphQLList', 'GraphQLNonNull')) {
    current = (current as { ofType: unknown }).ofType
  }
  return (current as NamedTypeRef | null) ?? null
}

function listItemType(type: TypeRef | null): TypeRef | null {
  let current: unknown = type
  if (current && hasTag(current, 'GraphQLNonNull')) {
    current = (current as { ofType: unknown }).ofType
  }
  return current && hasTag(current, 'GraphQLList') ? (current as { ofType: TypeRef }).ofType : (current as TypeRef | null)
}

function inputFieldsOf(type: TypeRef | null): Record<string, ArgumentRef> {
  const named = namedTypeOf(type)
  return named && hasTag(named, 'GraphQLInputObjectType')
    ? (named as unknown as { getFields: () => Record<string, ArgumentRef> }).getFields()
    : {}
}

function hasFields(type: NamedTypeRef): boolean {
  return hasTag(type, 'GraphQLObjectType', 'GraphQLInterfaceType')
}

function fieldsOf(type: NamedTypeRef): Record<string, FieldRef> {
  return (type as unknown as { getFields: () => Record<string, FieldRef> }).getFields()
}

function isUnion(type: NamedTypeRef): boolean {
  return hasTag(type, 'GraphQLUnionType')
}

function implementsInterface(type: NamedTypeRef, interfaceName: string): boolean {
  if (!hasTag(type, 'GraphQLObjectType', 'GraphQLInterfaceType')) {
    return false
  }
  const interfaces = (type as unknown as { getInterfaces: () => readonly NamedTypeRef[] }).getInterfaces()
  return interfaces.some(item => item.name === interfaceName)
}

function isInputType(type: NamedTypeRef): boolean {
  return hasTag(type, 'GraphQLScalarType', 'GraphQLEnumType', 'GraphQLInputObjectType')
}

function typeKindLabel(type: NamedTypeRef): string {
  const tag = Object.prototype.toString.call(type).slice(8, -1)
  return tag.replace(/^GraphQL/, '').replace(/Type$/, '').toLowerCase() || 'type'
}

function hasTag(value: unknown, ...tags: string[]): boolean {
  const tag = Object.prototype.toString.call(value).slice(8, -1)
  return tags.includes(tag)
}
