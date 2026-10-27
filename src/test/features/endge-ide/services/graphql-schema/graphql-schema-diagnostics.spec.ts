import type { GraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'

import { Endge, loadGraphQLSchema } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'

import {
  GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE,
  validateGraphQLSourceTemplates,
} from '@/features/endge-ide/services/graphql-schema/graphql-schema-diagnostics'
import { collectGraphQLSchemaProblems, GRAPHQL_SCHEMA_PROBLEM_SOURCE_PATH } from '@/features/endge-ide/services/graphql-schema/graphql-schema-problems'
import { resolveGraphQLSchemaTarget } from '@/features/endge-ide/services/graphql-schema/graphql-schema-target'
import {
  findGraphQLSourceTemplates,
  findGraphQLTemplateAt,
  toGraphQLOffset,
  toSourceOffset,
} from '@/features/endge-ide/services/graphql-schema/graphql-template-locator'
import { TEST_GRAPHQL_SDL } from '@/test/features/endge-ide/services/graphql-schema/graphql-schema-fixture'

const schema = loadGraphQLSchema(TEST_GRAPHQL_SDL).schema!

function querySource(document: string): string {
  return `defineQuery({
  kind: 'graphql',
  request: {
    endpoint: 'https://api.example.test/graphql',
    // gql\`ignored { comment }\`
    operationName: 'Load',
    document: gql\`${document}\`,
  },
})`
}

/**
 * Поиск gql`...` в Source и перевод позиций: маркеры схемы должны указывать на имя
 * ошибочного поля в редакторе, даже когда шаблон содержит escape-последовательности.
 */
describe('gql-шаблоны в Source', () => {
  it('находит только gql-шаблоны вне комментариев и строк', () => {
    const source = `const a = 'gql\`x\`'\n// gql\`y\`\n/* gql\`z\` */\nconst b = gql  \`query { user }\`\nconst c = \`gql\``
    const templates = findGraphQLSourceTemplates(source)
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({ text: 'query { user }', closed: true })
    expect(source.slice(templates[0]!.contentStart, templates[0]!.contentEnd)).toBe('query { user }')
  })

  it('пропускает шаблон с interpolation и помечает незакрытый шаблон', () => {
    expect(findGraphQLSourceTemplates(`gql\`query { ${'$'}{field} }\``)).toEqual([])
    const [open] = findGraphQLSourceTemplates('document: gql`query { us')
    expect(open).toMatchObject({ closed: false, text: 'query { us' })
  })

  it('переводит смещения через escape-последовательности в обе стороны', () => {
    const source = 'gql`# \\`x\\` \\u0041\nquery { user }`'
    const [template] = findGraphQLSourceTemplates(source)
    expect(template!.text).toBe('# `x` A\nquery { user }')
    const graphQLOffset = template!.text.indexOf('user')
    const sourceOffset = toSourceOffset(template!, graphQLOffset)
    expect(source.slice(sourceOffset, sourceOffset + 4)).toBe('user')
    expect(toGraphQLOffset(template!, sourceOffset)).toBe(graphQLOffset)
    expect(findGraphQLTemplateAt([template!], template!.contentEnd)).toBe(template)
    expect(findGraphQLTemplateAt([template!], 0)).toBeNull()
  })
})

/**
 * Маркеры проверки по схеме: позиции core validateGraphQLDocument переводятся в Source,
 * у них свой источник и они не заменяют диагностики компилятора.
 */
describe('проверка gql-документа Source по схеме', () => {
  it('выделяет неизвестное поле в координатах Source', () => {
    const source = querySource('query Load { user(id: "1") { nam } }')
    const diagnostics = validateGraphQLSourceTemplates(schema, source)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ severity: 'error', code: 'graphql-document-validation' })
    expect(source.slice(diagnostics[0]!.start, diagnostics[0]!.end)).toBe('nam')
    expect(GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE).toBe('GraphQL schema')
  })

  it('сообщает о неизвестном аргументе и неверном типе переменной', () => {
    const source = querySource('query Load($id: String!) {\n  user(id: $id, limit: 1) { id }\n}')
    const diagnostics = validateGraphQLSourceTemplates(schema, source)
    const fragments = diagnostics.map(item => source.slice(item.start, item.end))
    expect(fragments).toContain('limit')
    expect(diagnostics.some(item => item.message.includes('$id'))).toBe(true)
  })

  it('синтаксическая ошибка получает непустой диапазон внутри шаблона', () => {
    const source = querySource('query Load { user(id: "1") { id }')
    const [diagnostic] = validateGraphQLSourceTemplates(schema, source)
    expect(diagnostic).toMatchObject({ code: 'graphql-document-syntax' })
    expect(diagnostic!.end).toBeGreaterThan(diagnostic!.start)
    const [template] = findGraphQLSourceTemplates(source)
    expect(diagnostic!.start).toBeGreaterThanOrEqual(template!.contentStart)
    expect(diagnostic!.end).toBeLessThanOrEqual(template!.contentEnd)
  })

  it('корректный документ и незакрытый шаблон не дают маркеров', () => {
    expect(validateGraphQLSourceTemplates(schema, querySource('query Load { user(id: "1") { id fullName } }'))).toEqual([])
    expect(validateGraphQLSourceTemplates(schema, 'gql`query { nope')).toEqual([])
  })
})

describe('фрагменты в отдельных gql-шаблонах (request.fragments)', () => {
  // W12b: document со spread и фрагменты в contextSwitch — разные шаблоны одного Source.
  const source = `defineQuery({
  kind: 'graphql',
  request: {
    endpoint: 'https://api.example.test/graphql',
    document: gql\`query Load($id: ID!) { user(id: $id) { ...UserFields } }\`,
    fragments: {
      UserFields: contextSwitch({
        default: gql\`fragment UserFields on User { id fullName }\`,
        cases: [{ when: { tenant: 'kzn' }, use: gql\`fragment UserFields on User { id fullName role }\` }],
      }),
    },
  },
})`

  it('не сообщает Unknown fragment и Fragment is never used для фрагментов соседних шаблонов', () => {
    expect(validateGraphQLSourceTemplates(schema, source)).toEqual([])
  })

  it('по-прежнему проверяет поля фрагмента и неизвестные фрагменты', () => {
    const broken = source
      .replace('{ id fullName role }', '{ id fullName missingField }')
      .replace('...UserFields }', '...UserFields ...OtherFields }')
    const messages = validateGraphQLSourceTemplates(schema, broken).map(diagnostic => diagnostic.message)
    expect(messages).toEqual(expect.arrayContaining([
      expect.stringContaining('missingField'),
      'Unknown fragment "OtherFields".',
    ]))
    expect(messages.some(message => message.includes('UserFields'))).toBe(false)
  })

  it('фрагмент без spread ни в одном шаблоне остаётся неиспользуемым', () => {
    const unused = source.replace('{ ...UserFields }', '{ id }')
    const messages = validateGraphQLSourceTemplates(schema, unused).map(diagnostic => diagnostic.message)
    expect(messages).toContain('Fragment "UserFields" is never used.')
  })
})

describe('маркеры схемы в панели «Диагностика»', () => {
  it('переводит проверку по схеме в authoring-диагностики только при сохранённой схеме', () => {
    const source = querySource('query Load { missingField }')
    const entryFor = vi.fn((target: GraphQLSchemaTarget | null) => target?.endpoint === 'https://api.example.test/graphql' ? { schema } : null)

    const problems = collectGraphQLSchemaProblems({ entryFor }, Endge.source, 'query', source)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ severity: 'error', sourcePath: GRAPHQL_SCHEMA_PROBLEM_SOURCE_PATH })
    expect(problems[0]!.message.startsWith(`${GRAPHQL_SCHEMA_DIAGNOSTIC_SOURCE}: `)).toBe(true)
    expect(source.slice(problems[0]!.start, problems[0]!.end)).toBe('missingField')
    expect(collectGraphQLSchemaProblems({ entryFor: () => null }, Endge.source, 'query', source)).toEqual([])
  })

  it('stream с url из props не привязывает схему к статическому endpoint', () => {
    const target = resolveGraphQLSchemaTarget(Endge.source, 'stream', `defineStream({
  props: defineProps({ endpoint: field('String') }),
  transport: graphqlSse({ url: prop('endpoint'), document: gql\`subscription { tick }\` }),
  events: { next: event('tick') },
})`)
    expect(target).toMatchObject({ dynamicEndpoint: true, endpoint: '' })
  })
})
