import { describe, expect, it } from 'vitest'

import {
  cloneTypeSourceDocument,
  createDefaultTypeSourceField,
  parseTypeVisualSource,
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
})
