import type { ComponentSFCPropsVisualProjection } from '@endge/core'

import { describe, expect, it } from 'vitest'

import {
  componentSFCPropsToVisualDocument,
  visualDocumentToComponentSFCProps,
} from '@/features/endge-ide/model/component-sfc-editor/component-sfc-props-visual'

function projection(props: ComponentSFCPropsVisualProjection['props']): ComponentSFCPropsVisualProjection {
  return {
    mode: 'inline-type',
    editable: true,
    props,
    sourceRange: null,
  }
}

describe('component SFC props visual projection', () => {
  it('keeps array item types separate from the array modifier', () => {
    const document = componentSFCPropsToVisualDocument(projection([
      { name: 'rows', type: 'Array<Flight>', isArray: true },
    ]))

    expect(document.definition).toMatchObject({
      kind: 'object',
      fields: [{
        key: 'rows',
        type: { kind: 'reference', identity: 'Flight' },
        array: true,
      }],
    })
    expect(visualDocumentToComponentSFCProps(document)).toEqual([
      { name: 'rows', type: 'Flight', isArray: true, optional: false },
    ])
  })

  it('serializes inline objects created by the reusable schema editor', () => {
    const props = visualDocumentToComponentSFCProps({
      definition: {
        kind: 'object',
        fields: [{
          key: 'options',
          type: {
            kind: 'object',
            fields: [{
              key: 'pageSize',
              type: { kind: 'reference', identity: 'number' },
              optional: true,
              array: false,
              examples: [],
            }],
          },
          optional: false,
          array: false,
          examples: [],
        }],
      },
    })

    expect(props[0]?.type).toBe('{ pageSize?: number }')
  })
})
