import { loadGraphQLSchema } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { completeGraphQLDocument } from '@/features/endge-ide/services/graphql-schema/graphql-schema-completions'
import { TEST_GRAPHQL_SDL } from '@/test/features/endge-ide/services/graphql-schema/graphql-schema-fixture'

const schema = loadGraphQLSchema(TEST_GRAPHQL_SDL).schema!

// Курсор задаётся символом | в тексте документа.
function complete(textWithCursor: string) {
  const cursor = textWithCursor.indexOf('|')
  const text = textWithCursor.replace('|', '')
  return completeGraphQLDocument(schema, text, cursor)
}

function labels(textWithCursor: string): string[] {
  return complete(textWithCursor).map(item => item.label)
}

/**
 * Автодополнение gql-документа по сохранённой схеме: поля, аргументы, типы и значения.
 * Сценарии защищают разбор незаконченного документа, который нельзя передать в graphql parse.
 */
describe('автодополнение GraphQL-документа по схеме', () => {
  it('в корне документа предлагает виды operation', () => {
    expect(labels('|')).toEqual(['query', 'mutation', 'subscription', 'fragment'])
  })

  it('в selection set operation предлагает поля корневого типа с типом и описанием', () => {
    const items = complete('query Load { |')
    expect(items.map(item => item.label)).toEqual(['user', 'search', 'node', '__typename'])
    expect(items[0]).toMatchObject({ kind: 'field', detail: 'User', documentation: 'Пользователь по id' })
  })

  it('анонимный документ и subscription выбирают свой корневой тип', () => {
    expect(labels('{ |')).toContain('user')
    expect(labels('subscription { |')).toEqual(['userChanged', '__typename'])
  })

  it('во вложенном selection set предлагает поля типа поля, в том числе после alias', () => {
    expect(labels('query { user(id: "1") { |')).toEqual(['id', 'name', 'fullName', 'role', 'friends', '__typename'])
    expect(labels('query { me: user(id: "1") { friends { |')).toContain('fullName')
    const deprecated = complete('query { user(id: "1") { |').find(item => item.label === 'name')
    expect(deprecated?.deprecated).toBe(true)
  })

  it('набираемое имя не меняет контекст: подсказки остаются полями текущего типа', () => {
    expect(labels('query { user(id: "1") { fu|')).toContain('fullName')
  })

  it('в аргументах поля предлагает ещё не использованные аргументы', () => {
    expect(labels('query { user(|')).toEqual(['id', 'role'])
    expect(labels('query { user(id: "1", |')).toEqual(['role'])
    expect(complete('query { user(|')[0]).toMatchObject({ kind: 'argument', insertText: 'id: ', detail: 'ID!' })
  })

  it('для значения enum-аргумента предлагает значения enum и объявленные переменные', () => {
    expect(labels('query Load($role: Role) { user(id: "1", role: |')).toEqual(['ADMIN', 'EDITOR', '$role'])
    expect(labels('query Load($id: ID!) { user(id: $|')).toEqual(['id'])
  })

  it('в input object аргумента предлагает поля input-типа, включая вложенные', () => {
    expect(labels('query { search(filter: { |')).toEqual(['role', 'name', 'nested'])
    expect(labels('query { search(filter: { nested: { role: |')).toEqual(['ADMIN', 'EDITOR'])
  })

  it('после закрытия аргументов возвращается к полям', () => {
    expect(labels('query { search(filter: { role: ADMIN }, first: 5) { ... on User { id } |')).toEqual(['__typename'])
  })

  it('в объявлении переменной предлагает только input-типы', () => {
    const result = labels('query Load($id: |')
    expect(result).toEqual(expect.arrayContaining(['ID', 'Role', 'UserFilter', 'String']))
    expect(result).not.toContain('User')
    expect(labels('query Load($ids: [|')).toContain('ID')
  })

  it('после ... on предлагает типы, допустимые для union и interface', () => {
    expect(labels('query { search { ... on |')).toEqual(['Bot', 'SearchResult', 'User'])
    expect(labels('query { node(id: "1") { ... on |')).toEqual(['Bot', 'Node', 'User'])
    expect(labels('query { node(id: "1") { ... on User { |')).toContain('fullName')
    expect(labels('query { node(id: "1") { ... { |')).toEqual(['id', '__typename'])
  })

  it('во fragment выбирает тип условия', () => {
    expect(labels('fragment UserParts on |')).toContain('User')
    expect(labels('fragment UserParts on User { |')).toContain('friends')
  })

  it('после @ предлагает директивы схемы', () => {
    expect(labels('query { user(id: "1") @|')).toEqual(expect.arrayContaining(['include', 'skip']))
  })

  it('внутри строки и комментария подсказок нет', () => {
    expect(labels('query { user(id: "1|')).toEqual([])
    expect(labels('query { # user |')).toEqual([])
  })
})
