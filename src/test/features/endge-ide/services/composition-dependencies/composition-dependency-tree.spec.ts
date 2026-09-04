import { Endge, RComposition } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildCompositionDependencyHierarchy,
  buildCompositionDependencyTree,
  countCompositionDependencies,
} from '../../../../../features/endge-ide/services/composition-dependencies/composition-dependency-tree'

let entityId = 0

describe('дерево зависимостей Composition', () => {
  afterEach(() => {
    Endge.domain.reset()
  })

  it('сохраняет повторные вхождения Composition как отдельные ветви', () => {
    addComposition(
      'shared-table',
      `
defineComposition({
  runtimes: {},
})
`,
    )

    const result = buildCompositionDependencyTree({
      identity: 'groundhandling-page',
      displayName: 'Ground handling',
      source: `
defineComposition({
  runtimes: {
    arrival: composition('shared-table'),
    departure: composition('shared-table'),
  },
})
`,
    })

    expect(result.status).toBe('valid')
    expect(result.root?.children).toHaveLength(2)
    expect(result.root?.children.map(node => node.identity)).toEqual([
      'shared-table',
      'shared-table',
    ])
    expect(new Set(result.root?.children.map(node => node.id)).size).toBe(2)
    expect(countCompositionDependencies(result.root)).toBe(2)
  })

  it('помечает повторного предка как локальный для ветви cycle', () => {
    const rootSource = `
defineComposition({
  runtimes: {
    child: composition('child-composition'),
  },
})
`
    addComposition('root-composition', rootSource)
    addComposition(
      'child-composition',
      `
defineComposition({
  runtimes: {
    parent: composition('root-composition'),
  },
})
`,
    )

    const result = buildCompositionDependencyTree({
      identity: 'root-composition',
      source: rootSource,
    })

    expect(result.status).toBe('valid')
    expect(result.root?.children[0]?.status).toBe('valid')
    expect(result.root?.children[0]?.children[0]?.status).toBe('cycle')
  })

  it('возвращает безопасное пустое дерево, если текущий Source не компилируется', () => {
    const result = buildCompositionDependencyTree({
      identity: 'broken-composition',
      source: 'defineComposition({',
    })

    expect(result.status).toBe('compile-error')
    expect(result.root).toBeNull()
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })

  it('оставляет вложенную ошибку компиляции локальной для её ветви', () => {
    addComposition('broken-child', 'defineComposition({')

    const result = buildCompositionDependencyTree({
      identity: 'valid-parent',
      source: `
defineComposition({
  runtimes: {
    child: composition('broken-child'),
  },
})
`,
    })

    expect(result.status).toBe('valid')
    expect(result.root?.children[0]?.status).toBe('compile-error')
    expect(result.root?.children[0]?.diagnosticCount).toBeGreaterThan(0)
  })

  it('добавляет каждое прямое и рекурсивное вхождение использования в режиме полной иерархии', () => {
    addComposition('current-composition', `
defineComposition({
  runtimes: {},
})
`)
    addComposition('parent-a', `
defineComposition({
  runtimes: {
    first: composition('current-composition'),
    second: composition('current-composition'),
  },
})
`)
    addComposition('parent-b', `
defineComposition({
  runtimes: {
    current: composition('current-composition'),
  },
})
`)
    addComposition('grandparent', `
defineComposition({
  runtimes: {
    parent: composition('parent-a'),
  },
})
`)

    const result = buildCompositionDependencyHierarchy({
      identity: 'current-composition',
      source: `
defineComposition({
  runtimes: {},
})
`,
    })

    const usedBy = result.root?.children[0]
    const dependencies = result.root?.children[1]
    expect(usedBy?.kind).toBe('group')
    expect(usedBy?.children.map(node => node.identity)).toEqual([
      'parent-a',
      'parent-a',
      'parent-b',
    ])
    expect(usedBy?.children[0]?.children[0]?.identity).toBe('grandparent')
    expect(usedBy?.children[1]?.children[0]?.identity).toBe('grandparent')
    expect(dependencies).toMatchObject({
      kind: 'group',
      title: 'Зависимости',
      children: [],
    })
    expect(countCompositionDependencies(result.root)).toBe(5)
  })

  it('останавливает обратные циклы использования на повторном предке', () => {
    const currentSource = `
defineComposition({
  runtimes: {
    parent: composition('parent-composition'),
  },
})
`
    addComposition('current-composition', currentSource)
    addComposition('parent-composition', `
defineComposition({
  runtimes: {
    current: composition('current-composition'),
  },
})
`)

    const result = buildCompositionDependencyHierarchy({
      identity: 'current-composition',
      source: currentSource,
    })

    const reverseCycle = result.root?.children[0]?.children[0]?.children[0]
    expect(reverseCycle).toMatchObject({
      identity: 'current-composition',
      status: 'cycle',
    })
  })
})

function addComposition(identity: string, source: string): RComposition {
  const composition = new RComposition()
  composition.id = ++entityId
  composition.identity = identity
  composition.name = identity
  composition.source = source
  Endge.domain.addComposition(composition)
  return composition
}
