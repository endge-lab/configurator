import { Endge } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  canRunQueryWithoutInput,
  parseQueryRunValues,
  previewGraphQLVariables,
  QUERY_RUN_DEFAULT_OPTION,
  readQueryRunForm,
} from '@/features/endge-ide/services/query-run/query-run-form'

const REST_SOURCE = `defineQuery({
  kind: 'rest',
  props: defineProps({
    search: field('String'),
    limit: field('Number').default(20),
    active: field('Boolean').optional(),
    filter: field('Object'),
    ids: field('String').array(),
  }),
  request: { endpoint: 'https://rest.example.test', path: '/items', method: 'GET' },
  outputs: { raw: output().from(response()) },
})`

const GRAPHQL_SOURCE = `defineQuery({
  kind: 'graphql',
  props: defineProps({ id: field('String').default('item-1'), tenant: field('String') }),
  request: {
    endpoint: '{API_URL}/graphql',
    document: gql\`query Item($id: ID!, $tenant: String) { item(id: $id, tenant: $tenant) { id } }\`,
    variables: variables(({ prop }) => ({ id: prop('id'), tenant: prop('tenant') })),
  },
  outputs: { item: output().from(data('item')) },
})`

function form(source: string) {
  return readQueryRunForm(Endge.source.compile('query', source))
}

describe('форма запуска Query', () => {
  it('разрешает запуск одним кликом, только если ни один prop не требует ввода', () => {
    const parse = (source: string) => Endge.source.parse<{ props?: never[] }>('query', source).document?.props
    expect(canRunQueryWithoutInput(parse(REST_SOURCE))).toBe(false)
    expect(canRunQueryWithoutInput(parse(GRAPHQL_SOURCE))).toBe(false)
    expect(canRunQueryWithoutInput(parse(GRAPHQL_SOURCE.replace('tenant: field(\'String\')', 'tenant: field(\'String\').optional()')))).toBe(true)
    expect(canRunQueryWithoutInput(parse(`defineQuery({
  kind: 'graphql',
  request: { endpoint: 'https://graphql.example.test', document: gql\`query Items { items { id } }\` },
  outputs: { items: output().from(data('items')) },
})`))).toBe(true)
    expect(canRunQueryWithoutInput(null)).toBe(false)
  })

  it('строит поля из defineProps с типами, необязательностью и default', () => {
    const result = form(REST_SOURCE)

    expect(result.compileError).toBeNull()
    expect(result.protocol).toBe('REST')
    expect(result.fields.map(field => [field.key, field.typeLabel, field.control])).toEqual([
      ['search', 'String', 'text'],
      ['limit', 'Number', 'number'],
      ['active', 'Boolean', 'boolean'],
      ['filter', 'Object', 'json'],
      ['ids', 'String[]', 'json'],
    ])
    expect(result.fields.find(field => field.key === 'limit')?.defaultText).toBe('20')
    expect(result.fields.find(field => field.key === 'active')?.optional).toBe(true)
  })

  it('разбирает значения по типам и пропускает пустые, оставляя default runtime', () => {
    const { fields } = form(REST_SOURCE)

    expect(parseQueryRunValues(fields, {
      search: 'abc',
      limit: '',
      active: 'false',
      filter: '{"status":"open"}',
      ids: '["a","b"]',
    })).toEqual({
      props: { search: 'abc', active: false, filter: { status: 'open' }, ids: ['a', 'b'] },
      errors: {},
    })
    expect(parseQueryRunValues(fields, { active: QUERY_RUN_DEFAULT_OPTION, limit: '7' }).props).toEqual({ limit: 7 })
  })

  it('возвращает коды ошибок для неверного числа и JSON', () => {
    const { fields } = form(REST_SOURCE)

    expect(parseQueryRunValues(fields, { limit: 'abc', filter: '{bad' }).errors).toEqual({
      limit: 'number',
      filter: 'json',
    })
  })

  it('показывает ошибку компиляции Source', () => {
    const result = form(`defineQuery({ request: { endpoint: 1 } })`)

    expect(result.compileError).toBeTruthy()
  })

  it('вычисляет итоговые GraphQL variables из default и значений формы', () => {
    const result = form(GRAPHQL_SOURCE)

    expect(result.protocol).toBe('GraphQL')
    expect(previewGraphQLVariables(result.payload, { tenant: 'ou' }, name => `env:${name}`)).toEqual({
      value: { id: 'item-1', tenant: 'ou' },
      error: null,
    })
    expect(previewGraphQLVariables(result.payload, { id: 'item-2' }, () => undefined).value).toEqual({ id: 'item-2' })
  })

  it('не строит variables для REST', () => {
    expect(previewGraphQLVariables(form(REST_SOURCE).payload, {}, () => undefined)).toEqual({ value: null, error: null })
  })
})
