/* eslint-disable style/max-statements-per-line */
import { describe, expect, it } from 'vitest'

import {
  cloneTypeSourceDocument,
  createDefaultTypeSourceField,
  parseTypeVisualSource,
  serializeTypeSourceDocument,
} from '@/features/endge-ide/model/type-visual-editor'

describe('type visual editor model', () => {
  it('round-trips an object Type Source through the semantic document', () => {
    const parsed = parseTypeVisualSource(`defineType({
  identity: field('String')
    .description('Stable identifier'),

  score: field('Number')
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

  it('keeps the parsed document immutable while editing a detached copy', () => {
    const parsed = parseTypeVisualSource('defineType({ value: field(\'String\') })')
    const copy = cloneTypeSourceDocument(parsed.document!)

    if (copy.definition.kind === 'object') { copy.definition.fields.push(createDefaultTypeSourceField('next')) }

    expect(parsed.document?.definition.kind === 'object' && parsed.document.definition.fields).toHaveLength(1)
    expect(copy.definition.kind === 'object' && copy.definition.fields).toHaveLength(2)
  })

  it('round-trips enum, union and array roots', () => {
    const sources = [
      'defineType(enumOf([\'draft\', \'active\']))',
      'defineType(unionOf(type(\'String\'), type(\'Number\')))',
      'defineType(arrayOf(type(\'Flight\')))',
    ]

    for (const source of sources) {
      const parsed = parseTypeVisualSource(source)
      expect(parsed.valid).toBe(true)
      expect(parseTypeVisualSource(serializeTypeSourceDocument(parsed.document!)).document).toEqual(parsed.document)
    }
  })

  it('round-trips recursive objectOf expressions without turning them into references', () => {
    const source = `defineType({
      order: field(objectOf({
        customer: field('Customer'),
        delivery: field(objectOf({
          city: field('String'),
          point: field(arrayOf(objectOf({
            x: field('Number'),
            y: field('Number'),
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

  it('round-trips inline union and array variants', () => {
    const source = `defineType(unionOf(
      type('Known'),
      objectOf({ value: field('String') }),
      arrayOf(objectOf({ code: field('ID') })),
    ))`
    const parsed = parseTypeVisualSource(source)

    expect(parsed.valid).toBe(true)
    expect(parseTypeVisualSource(serializeTypeSourceDocument(parsed.document!)).document).toEqual(parsed.document)
  })
})
