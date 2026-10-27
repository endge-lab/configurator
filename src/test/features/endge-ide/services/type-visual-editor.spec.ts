import type { TypeSourceDefinition } from '@endge/core'

import { describe, expect, it } from 'vitest'

import {
  cloneTypeSourceDocument,
  createDefaultTypeSourceField,
  parseTypeVisualSource,
  resolveTypeVisualExtends,
  serializeTypeSourceDocument,
} from '@/features/endge-ide/services/type-visual-editor'

describe('модель визуального редактора Type', () => {
  it('сохраняет объектный Type Source при двустороннем преобразовании через семантический документ', () => {
    const parsed = parseTypeVisualSource(`defineType({
  identity: field(String)
    .description('Stable identifier'),

  score: field(Number)
    .min(0)
    .max(1)
    .example(0.7)
    .optional(),
})`)

    expect(parsed.valid).toBe(true)
    expect(parsed.document?.definition.kind).toBe('object')

    const serialized = serializeTypeSourceDocument(parsed.document!)
    const reparsed = parseTypeVisualSource(serialized)

    expect(reparsed.valid).toBe(true)
    expect(reparsed.document).toEqual(parsed.document)
  })

  it('сохраняет разобранный документ неизменяемым при редактировании отделённой копии', () => {
    const parsed = parseTypeVisualSource('defineType({ value: field(\'String\') })')
    const copy = cloneTypeSourceDocument(parsed.document!)

    if (copy.definition.kind === 'object') {
      copy.definition.fields.push(createDefaultTypeSourceField('next'))
    }

    expect(parsed.document?.definition.kind === 'object' && parsed.document.definition.fields).toHaveLength(1)
    expect(copy.definition.kind === 'object' && copy.definition.fields).toHaveLength(2)
  })

  it('сохраняет корни enum, union и array при двустороннем преобразовании', () => {
    const sources = [
      'defineType(enumOf([\'draft\', \'active\']))',
      'defineType(unionOf(String, Number))',
      'defineType(arrayOf(Flight))',
    ]

    for (const source of sources) {
      const parsed = parseTypeVisualSource(source)
      expect(parsed.valid).toBe(true)
      expect(parseTypeVisualSource(serializeTypeSourceDocument(parsed.document!)).document).toEqual(parsed.document)
    }
  })

  it('сохраняет рекурсивные выражения objectOf при двустороннем преобразовании, не превращая их в ссылки', () => {
    const source = `defineType({
      order: field(objectOf({
        customer: field(Customer),
        delivery: field(objectOf({
          city: field(String),
          point: field(arrayOf(objectOf({
            x: field(Number),
            y: field(Number),
          }))),
        })).optional(),
      })),
    })`

    const parsed = parseTypeVisualSource(source)
    expect(parsed.valid).toBe(true)

    const serialized = serializeTypeSourceDocument(parsed.document!)
    expect(serialized).toContain('field(objectOf({')
    expect(serialized).toContain('field(arrayOf(')
    expect(parseTypeVisualSource(serialized).document).toEqual(parsed.document)
  })

  it('сохраняет inline-варианты union и array при двустороннем преобразовании', () => {
    const source = `defineType(unionOf(
      Known,
      objectOf({ value: field(String) }),
      arrayOf(objectOf({ code: field(ID) })),
    ))`
    const parsed = parseTypeVisualSource(source)

    expect(parsed.valid).toBe(true)
    const serialized = serializeTypeSourceDocument(parsed.document!)
    expect(serialized).toContain('Known,')
    expect(serialized).not.toContain(`type('Known')`)
    expect(parseTypeVisualSource(serialized).document).toEqual(parsed.document)
  })

  it('сохраняет extends при визуальном изменении собственных полей', () => {
    const parsed = parseTypeVisualSource(`defineType({
  extends: type('Flight'),
  fields: {
    stand: field(String),
  },
})`)

    expect(parsed.valid).toBe(true)
    const document = cloneTypeSourceDocument(parsed.document!)
    if (document.definition.kind !== 'object') {
      throw new Error('expected object Type')
    }
    document.definition.fields.push(createDefaultTypeSourceField('handlingAgent'))
    const serialized = serializeTypeSourceDocument(document)

    expect(serialized).toContain(`extends: type('Flight')`)
    expect(serialized).toContain('handlingAgent')
    expect(parseTypeVisualSource(serialized).document?.definition).toMatchObject({ extends: { kind: 'reference', identity: 'Flight' } })
  })

  it('не открывает визуальный режим для Type с contextSwitch, чтобы не потерять варианты', () => {
    const parsed = parseTypeVisualSource(`defineType({
  place: field(contextSwitch({ default: type('Gate'), cases: [{ when: { tenant: 'kzn' }, use: type('Stand') }] })),
})`)

    expect(parsed.valid).toBe(false)
    expect(parsed.diagnostics.map(item => item.code)).toContain('type-visual-context-switch')
  })
})

describe('extends в визуальном редакторе Type', () => {
  const sources: Record<string, string> = {
    Base: `defineType({
  id: field(String),
  name: field(String).optional(),
})`,
    Flight: `defineType({
  extends: type('Base'),
  fields: {
    number: field(String),
  },
})`,
    Loop: `defineType({
  extends: type('Loop2'),
  fields: { a: field(String) },
})`,
    Loop2: `defineType({
  extends: type('Loop'),
  fields: { b: field(String) },
})`,
    Status: `defineType(enumOf(['a', 'b']))`,
  }
  const lookup = (identity: string): TypeSourceDefinition | null | undefined => {
    if (identity === 'String') {
      return null
    }
    const source = sources[identity]
    return source ? parseTypeVisualSource(source).document?.definition ?? undefined : undefined
  }
  const authored = (source: string): TypeSourceDefinition => parseTypeVisualSource(source).document!.definition

  it('разворачивает цепочку базовых Type: унаследованные поля первыми с inheritedFrom', () => {
    const definition = authored(`defineType({
  extends: type('Flight'),
  fields: {
    stand: field(String),
    name: field(String),
  },
})`)
    const result = resolveTypeVisualExtends(definition, lookup, 'FlightKzn')

    expect(result.base).toBe('Flight')
    expect(result.missingBase).toBeNull()
    expect(result.invalidBase).toBeNull()
    expect(result.definition.kind).toBe('object')
    const fields = result.definition.kind === 'object' ? result.definition.fields : []
    // Собственное name (optional → required) заменяет унаследованное на его месте.
    expect(fields.map(field => [field.key, field.inheritedFrom ?? null, field.optional])).toEqual([
      ['id', 'Base', false],
      ['name', null, false],
      ['number', 'Flight', false],
      ['stand', null, false],
    ])
  })

  it('не меняет authored document: визуальное сохранение сохраняет extends и только собственные поля', () => {
    const source = `defineType({
  extends: type('Flight'),
  fields: {
    stand: field(String),
  },
})`
    const parsed = parseTypeVisualSource(source)
    resolveTypeVisualExtends(parsed.document!.definition, lookup, 'FlightKzn')
    const serialized = serializeTypeSourceDocument(parsed.document!)

    expect(serialized).toContain('extends: type(\'Flight\')')
    expect(serialized).toContain('stand: field(String)')
    expect(serialized).not.toContain('number')
    expect(serialized).not.toContain('id:')
  })

  it('сообщает о ненайденной базе, цикле и не-object базе, оставляя собственные поля', () => {
    const missing = resolveTypeVisualExtends(authored(`defineType({ extends: type('Nope'), fields: { a: field(String) } })`), lookup)
    expect(missing.missingBase).toBe('Nope')
    expect(missing.definition.kind === 'object' && missing.definition.fields.map(field => field.key)).toEqual(['a'])

    const cycle = resolveTypeVisualExtends(lookup('Loop')!, lookup, 'Loop')
    expect(cycle.invalidBase).toBe('cycle')

    const notObject = resolveTypeVisualExtends(authored(`defineType({ extends: type('Status'), fields: { a: field(String) } })`), lookup)
    expect(notObject.invalidBase).toBe('not-object')
    expect(notObject.definition.kind === 'object' && notObject.definition.fields.map(field => field.key)).toEqual(['a'])
  })

  it('без extends возвращает definition без изменений', () => {
    const definition = authored(`defineType({ a: field(String) })`)
    const result = resolveTypeVisualExtends(definition, lookup)
    expect(result.base).toBeNull()
    expect(result.definition).toBe(definition)
  })
})
