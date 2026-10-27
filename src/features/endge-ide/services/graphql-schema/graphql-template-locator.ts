// Статический gql`...` внутри Source: cooked-текст GraphQL и карта смещений в Source.
export interface GraphQLSourceTemplate {
  // Смещение первого символа содержимого после открывающей ` в Source.
  contentStart: number
  // Смещение закрывающей ` в Source; для незакрытого шаблона — конец Source.
  contentEnd: number
  // Закрыт ли шаблон; незакрытый шаблон используется только для автодополнения.
  closed: boolean
  // Текст GraphQL document после обработки escape-последовательностей template literal.
  text: string
  // offsets[i] — смещение в Source символа text[i]; offsets[text.length] === contentEnd.
  offsets: number[]
}

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
}

/**
 * Находит статические gql`...` без interpolation вне строк и комментариев Source.
 * Шаблоны с `${...}` пропускаются: их отклоняет компилятор core.
 */
export function findGraphQLSourceTemplates(source: string): GraphQLSourceTemplate[] {
  const templates: GraphQLSourceTemplate[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]!
    const next = source[index + 1]
    if (char === '/' && next === '/') {
      index = skipUntil(source, index + 2, '\n')
      continue
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (char === '\'' || char === '"') {
      index = skipQuoted(source, index + 1, char)
      continue
    }
    if (char === '`') {
      index = skipTemplate(source, index + 1)
      continue
    }
    if (isIdentifierStart(char) && !isIdentifierPart(source[index - 1])) {
      const end = readIdentifierEnd(source, index)
      const identifier = source.slice(index, end)
      if (identifier === 'gql') {
        const backtick = skipWhitespace(source, end)
        if (source[backtick] === '`') {
          const template = readGraphQLTemplate(source, backtick + 1)
          if (template.template) {
            templates.push(template.template)
          }
          index = template.end
          continue
        }
      }
      index = end
      continue
    }
    index += 1
  }
  return templates
}

/**
 * Возвращает шаблон, содержимое которого включает позицию Source (включая позицию сразу после текста).
 */
export function findGraphQLTemplateAt(
  templates: readonly GraphQLSourceTemplate[],
  sourceOffset: number,
): GraphQLSourceTemplate | null {
  return templates.find(template => sourceOffset >= template.contentStart && sourceOffset <= template.contentEnd) ?? null
}

/**
 * Переводит смещение GraphQL-текста в смещение Source.
 */
export function toSourceOffset(template: GraphQLSourceTemplate, graphQLOffset: number): number {
  const safe = Math.max(0, Math.min(Math.trunc(graphQLOffset), template.text.length))
  return template.offsets[safe] ?? template.contentEnd
}

/**
 * Переводит смещение Source внутри шаблона в смещение GraphQL-текста.
 */
export function toGraphQLOffset(template: GraphQLSourceTemplate, sourceOffset: number): number {
  let result = 0
  for (let index = 0; index < template.offsets.length; index += 1) {
    if (template.offsets[index]! > sourceOffset) {
      break
    }
    result = index
  }
  return result
}

/**
 * Переводит 1-based line/column GraphQL-текста в смещение GraphQL-текста.
 */
export function graphQLLineColumnToOffset(text: string, line: number, column: number): number {
  let offset = 0
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf('\n', offset)
    if (next === -1) {
      return text.length
    }
    offset = next + 1
  }
  return Math.min(text.length, offset + Math.max(0, column - 1))
}

function readGraphQLTemplate(source: string, contentStart: number): { template: GraphQLSourceTemplate | null, end: number } {
  let text = ''
  const offsets: number[] = []
  let index = contentStart
  while (index < source.length) {
    const char = source[index]!
    if (char === '`') {
      offsets.push(index)
      return {
        template: { contentStart, contentEnd: index, closed: true, text, offsets },
        end: index + 1,
      }
    }
    if (char === '$' && source[index + 1] === '{') {
      // Interpolation делает document динамическим: пропускаем шаблон целиком.
      return { template: null, end: skipTemplate(source, index) }
    }
    if (char === '\\') {
      const escape = cookEscape(source, index)
      // Карта строится по UTF-16 единицам, как offset в GraphQL-тексте.
      for (let unit = 0; unit < escape.value.length; unit += 1) {
        offsets.push(index)
      }
      text += escape.value
      index = escape.end
      continue
    }
    text += char
    offsets.push(index)
    index += 1
  }
  offsets.push(source.length)
  return {
    template: { contentStart, contentEnd: source.length, closed: false, text, offsets },
    end: source.length,
  }
}

function cookEscape(source: string, slash: number): { value: string, end: number } {
  const marker = source[slash + 1]
  if (marker === undefined) {
    return { value: '', end: slash + 1 }
  }
  if (marker === '\r' && source[slash + 2] === '\n') {
    return { value: '', end: slash + 3 }
  }
  if (marker === '\n' || marker === '\r') {
    return { value: '', end: slash + 2 }
  }
  if (marker === 'x') {
    const hex = source.slice(slash + 2, slash + 4)
    if (/^[0-9a-f]{2}$/i.test(hex)) {
      return { value: String.fromCharCode(Number.parseInt(hex, 16)), end: slash + 4 }
    }
  }
  if (marker === 'u') {
    if (source[slash + 2] === '{') {
      const close = source.indexOf('}', slash + 3)
      const hex = close === -1 ? '' : source.slice(slash + 3, close)
      if (/^[0-9a-f]{1,6}$/i.test(hex)) {
        return { value: String.fromCodePoint(Number.parseInt(hex, 16)), end: close + 1 }
      }
    }
    const hex = source.slice(slash + 2, slash + 6)
    if (/^[0-9a-f]{4}$/i.test(hex)) {
      return { value: String.fromCharCode(Number.parseInt(hex, 16)), end: slash + 6 }
    }
  }
  return { value: SIMPLE_ESCAPES[marker] ?? marker, end: slash + 2 }
}

function skipUntil(source: string, index: number, terminator: string): number {
  const end = source.indexOf(terminator, index)
  return end === -1 ? source.length : end + terminator.length
}

function skipQuoted(source: string, index: number, quote: string): number {
  let cursor = index
  while (cursor < source.length) {
    const char = source[cursor]
    if (char === '\\') {
      cursor += 2
      continue
    }
    if (char === quote || char === '\n') {
      return cursor + 1
    }
    cursor += 1
  }
  return source.length
}

function skipTemplate(source: string, index: number): number {
  let cursor = index
  let depth = 0
  while (cursor < source.length) {
    const char = source[cursor]
    if (char === '\\') {
      cursor += 2
      continue
    }
    if (depth === 0 && char === '`') {
      return cursor + 1
    }
    if (char === '$' && source[cursor + 1] === '{') {
      depth += 1
      cursor += 2
      continue
    }
    if (depth > 0 && char === '}') {
      depth -= 1
    }
    cursor += 1
  }
  return source.length
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index
  while (cursor < source.length && /\s/.test(source[cursor]!)) {
    cursor += 1
  }
  return cursor
}

function readIdentifierEnd(source: string, index: number): number {
  let cursor = index
  while (cursor < source.length && isIdentifierPart(source[cursor])) {
    cursor += 1
  }
  return cursor
}

function isIdentifierStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Z_$]/i.test(char)
}

function isIdentifierPart(char: string | undefined): boolean {
  return char !== undefined && /[\w$]/.test(char)
}
