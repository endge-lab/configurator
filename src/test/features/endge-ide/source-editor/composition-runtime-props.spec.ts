import type { CompositionProgramPayload } from '@endge/core'
import type { CompositionRuntimePropsContract } from '@/features/endge-ide/services/composition-runtime-props/composition-runtime-props'

import { Endge } from '@endge/core'
import { describe, expect, it } from 'vitest'

import {
  analyzeCompositionRuntimeProps,
  generateCompositionRuntimeProps,
} from '@/features/endge-ide/services/composition-runtime-props/composition-runtime-props'
import { compositionRuntimePropsActionAnchor } from '@/features/endge-ide/source-editor/contributions/composition/runtime-props/composition-runtime-props.contribution'

const previewRequirements = {
  kind: 'literal' as const,
  value: {
    arrival: { attributes: ['STA'], groundHandling: [] },
    departure: { attributes: ['STD'], groundHandling: [] },
  },
}

describe('редактирование runtime props Composition', () => {
  it('сообщает предупреждение и генерирует withProps, если для каждого отсутствующего prop есть preview fixture', () => {
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

  it('размещает действие генерации после runtime-модификаторов в той же строке', () => {
    const source = `defineComposition({
  data: {
    db: store('groundhandling'),
  },
  runtimes: {
    requests: composition('groundhandling-query-general').storeTo(data('db'), {
      raw: output('raw'),
    }),
  },
})`
    const owner = compileOwner(source)
    const issue = analyzeCompositionRuntimeProps(owner, () => contract({
      requirements: previewRequirements,
    }))[0]!
    const actionAnchor = compositionRuntimePropsActionAnchor(source, issue.actionAnchor)

    expect(source.slice(0, actionAnchor)).toMatch(/\.storeTo\(data\('db'\), \{$/)
    expect(source[actionAnchor]).toBe('\n')
  })

  it('добавляет отсутствующие preview props в существующий объект withProps', () => {
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

  it('сохраняет ошибку и скрывает генерацию, если у обязательного prop нет preview fixture', () => {
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

  it('сохраняет предупреждение, но скрывает генерацию, если preview mock нельзя материализовать', () => {
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

  it('материализует preview mock перед генерацией явных runtime props', () => {
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
