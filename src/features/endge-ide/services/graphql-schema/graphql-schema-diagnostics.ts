import type { GraphQLDocumentDiagnostic, GraphQLSchemaInput } from '@endge/core'
import type { GraphQLSourceTemplate } from '@/features/endge-ide/services/graphql-schema/graphql-template-locator'

import { validateGraphQLDocument } from '@endge/core'

import {
  findGraphQLSourceTemplates,
  graphQLLineColumnToOffset,
  toSourceOffset,
} from '@/features/endge-ide/services/graphql-schema/graphql-template-locator'

// Источник маркеров проверки по схеме; отличает их от диагностик компилятора Source.
export const GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE = 'GraphQL schema'

// Диагностика проверки gql-документа по схеме в координатах Source.
export interface GraphQLSchemaSourceDiagnostic {
  severity: GraphQLDocumentDiagnostic['severity']
  code: string
  message: string
  // Полуинтервал [start, end) в Source.
  start: number
  end: number
}

/**
 * Проверяет каждый закрытый gql`...` Source по схеме и переводит позиции в Source.
 *
 * Фрагменты Query/Stream могут быть объявлены отдельными шаблонами (`request.fragments`,
 * в том числе ветками `contextSwitch`), а spread — в шаблоне document. Каждый шаблон
 * проверяется отдельно, поэтому «Unknown fragment» и «Fragment is never used» для
 * фрагментов, объявленных или использованных в другом шаблоне того же Source, не
 * являются ошибками и отбрасываются.
 */
export function validateGraphQLSourceTemplates(
  schema: GraphQLSchemaInput,
  source: string,
  templates: readonly GraphQLSourceTemplate[] = findGraphQLSourceTemplates(source),
): GraphQLSchemaSourceDiagnostic[] {
  const closed = templates.filter(template => template.closed)
  const fragments = closed.map(template => readTemplateFragments(template.text))
  return closed.flatMap((template, index) => {
    const definedElsewhere = new Set<string>()
    const spreadElsewhere = new Set<string>()
    fragments.forEach((other, otherIndex) => {
      if (otherIndex === index) {
        return
      }
      other.defined.forEach(name => definedElsewhere.add(name))
      other.spread.forEach(name => spreadElsewhere.add(name))
    })
    return validateGraphQLDocument(schema, template.text)
      .filter(diagnostic => !isCrossTemplateFragmentDiagnostic(diagnostic.message, definedElsewhere, spreadElsewhere))
      .map(diagnostic => toSourceDiagnostic(template, diagnostic))
  })
}

const UNKNOWN_FRAGMENT = /^Unknown fragment "([_A-Z]\w*)"\.$/i
const UNUSED_FRAGMENT = /^Fragment "([_A-Z]\w*)" is never used\.$/i

function isCrossTemplateFragmentDiagnostic(
  message: string,
  definedElsewhere: ReadonlySet<string>,
  spreadElsewhere: ReadonlySet<string>,
): boolean {
  const unknown = UNKNOWN_FRAGMENT.exec(message)
  if (unknown) {
    return definedElsewhere.has(unknown[1])
  }
  const unused = UNUSED_FRAGMENT.exec(message)
  return Boolean(unused && spreadElsewhere.has(unused[1]))
}

// Имена фрагментов, объявленных в шаблоне, и именованных spread (без inline `... on Type`).
function readTemplateFragments(text: string): { defined: Set<string>, spread: Set<string> } {
  const defined = new Set<string>()
  const spread = new Set<string>()
  for (const match of text.matchAll(/\bfragment\s+([_A-Z]\w*)\s+on\b/gi)) {
    defined.add(match[1])
  }
  for (const match of text.matchAll(/\.\.\.\s*([_A-Z]\w*)/gi)) {
    if (match[1] !== 'on') {
      spread.add(match[1])
    }
  }
  return { defined, spread }
}

/**
 * Переводит диагностику GraphQL-текста в диапазон Source; без позиции — весь шаблон.
 */
export function toSourceDiagnostic(
  template: GraphQLSourceTemplate,
  diagnostic: GraphQLDocumentDiagnostic,
): GraphQLSchemaSourceDiagnostic {
  const range = graphQLRange(template.text, diagnostic)
  let start = range ? toSourceOffset(template, range.start) : template.contentStart
  let end = range ? toSourceOffset(template, range.end) : template.contentEnd
  // Маркер должен быть видимым: пустой диапазон расширяется на символ внутри шаблона
  // (ошибка в конце документа выделяет последний символ перед закрывающей `).
  if (end <= start) {
    if (start < template.contentEnd) {
      end = start + 1
    }
    else if (start > template.contentStart) {
      start = template.contentEnd - 1
      end = template.contentEnd
    }
  }
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    start,
    end,
  }
}

function graphQLRange(text: string, diagnostic: GraphQLDocumentDiagnostic): { start: number, end: number } | null {
  if (typeof diagnostic.offset === 'number') {
    return { start: diagnostic.offset, end: diagnostic.offset + Math.max(0, diagnostic.length ?? 0) }
  }
  if (typeof diagnostic.line === 'number') {
    const start = graphQLLineColumnToOffset(text, diagnostic.line, diagnostic.column ?? 1)
    const end = typeof diagnostic.endLine === 'number'
      ? graphQLLineColumnToOffset(text, diagnostic.endLine, diagnostic.endColumn ?? 1)
      : start
    return { start, end }
  }
  return null
}
