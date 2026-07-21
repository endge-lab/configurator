import type { CompositionRuntimePropsContract } from '@/features/endge-ide/model/composition-runtime-props/composition-runtime-props'
import type { CompositionProgramPayload } from '@endge/core'

import { Endge } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  analyzeCompositionRuntimeProps,
  generateCompositionRuntimeProps,
} from '@/features/endge-ide/model/composition-runtime-props/composition-runtime-props'

const previewRequirements = {
  kind: 'literal' as const,
  value: {
    arrival: { attributes: ['STA'], groundHandling: [] },
    departure: { attributes: ['STD'], groundHandling: [] },
  },
}

describe('composition runtime props authoring', () => {
  it('reports a warning and generates withProps when every missing prop has a preview fixture', () => {
    const source = `defineComposition({
  data: {
    db: store('groundhandling'),
  },
  runtimes: {
    requests: composition('groundhandling-query-general')
      .storeTo(data('db'), {
        raw: output('raw'),
      }),
  },
})`
    const owner = compileOwner(source)
    const issues = analyzeCompositionRuntimeProps(owner, () => contract({
      requirements: previewRequirements,
    }))

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      missingProps: ['requirements'],
      canGenerate: true,
    })

    const generated = generateCompositionRuntimeProps(source, owner!, issues[0]!)
    const compiled = compileOwner(generated)
    expect(generated).toContain('composition(\'groundhandling-query-general\')\n      .withProps({')
    expect(compiled?.runtimes[0]?.props.requirements).toMatchObject({
      kind: 'literal',
      value: previewRequirements.value,
    })
  })

  it('merges missing preview props into an existing withProps object', () => {
    const source = `defineComposition({
  runtimes: {
    requests: composition('groundhandling-query-general').withProps({
      airport: 'SVO',
    }),
  },
})`
    const owner = compileOwner(source)
    const issues = analyzeCompositionRuntimeProps(owner, () => contract({
      airport: { kind: 'literal', value: 'LED' },
      requirements: previewRequirements,
    }, ['airport', 'requirements']))
    const generated = generateCompositionRuntimeProps(source, owner!, issues[0]!)
    const compiled = compileOwner(generated)

    expect(compiled?.runtimes[0]?.props.airport).toEqual({ kind: 'literal', value: 'SVO' })
    expect(compiled?.runtimes[0]?.props.requirements).toMatchObject({
      kind: 'literal',
      value: previewRequirements.value,
    })
  })

  it('keeps an error and hides generation when a required prop has no preview fixture', () => {
    const source = `defineComposition({
  runtimes: {
    requests: composition('groundhandling-query-general'),
  },
})`
    const owner = compileOwner(source)
    const issues = analyzeCompositionRuntimeProps(owner, () => contract())

    expect(issues).toMatchObject([{
      severity: 'error',
      missingProps: ['requirements'],
      canGenerate: false,
    }])
  })

  it('keeps a warning but hides generation when a preview mock cannot be materialized', () => {
    const source = `defineComposition({
  runtimes: {
    requests: composition('groundhandling-query-general'),
  },
})`
    const owner = compileOwner(source)
    const issues = analyzeCompositionRuntimeProps(owner, () => contract({
      requirements: { kind: 'mock', identity: 'missing-requirements' },
    }))

    expect(issues).toMatchObject([{
      severity: 'warning',
      missingProps: ['requirements'],
      canGenerate: false,
    }])
  })

  it('materializes a preview mock before generating explicit runtime props', () => {
    const source = `defineComposition({
  runtimes: {
    requests: composition('groundhandling-query-general'),
  },
})`
    const owner = compileOwner(source)
    const issues = analyzeCompositionRuntimeProps(
      owner,
      () => contract({ requirements: { kind: 'mock', identity: 'requirements' } }),
      value => value.kind === 'mock' ? previewRequirements.value : value.value,
    )
    const generated = generateCompositionRuntimeProps(source, owner!, issues[0]!)

    expect(issues[0]?.canGenerate).toBe(true)
    expect(compileOwner(generated)?.runtimes[0]?.props.requirements).toMatchObject({
      kind: 'literal',
      value: previewRequirements.value,
    })
  })
})

function compileOwner(source: string): CompositionProgramPayload | null {
  return (Endge.source.compile('composition', source).artifact as CompositionProgramPayload | undefined) ?? null
}

function contract(
  previewProps: CompositionRuntimePropsContract['previewProps'] = null,
  requiredProps: string[] = ['requirements'],
): CompositionRuntimePropsContract {
  return {
    props: requiredProps.map(key => ({
      key,
      type: 'Object',
      optional: false,
      array: false,
    })),
    previewProps,
  }
}
