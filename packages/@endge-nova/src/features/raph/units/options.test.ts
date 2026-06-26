import { describe, it, expect } from 'vitest'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import type { RaphProperties } from '@/features/raph/domain/types'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'

interface TestProps extends RaphProperties {
  value: number
  count: number
}

describe('RaphNode -  .options()', () => {
  it('устанавливает локальные значения и помечает dirty', () => {
    const { app, props } = NovaGraph.configureCustom({
      phases: [{ name: 'main', process: RaphPhase.processDirty }],
      properties: [
        {
          name: 'value',
          phase: 'main',
          compute: (n: RaphNode<TestProps>) => n.get('value') ?? 0,
        },
      ] as const,
    })

    const node = new RaphNode(app).options({ local: { value: 42 } })
    app.run()

    expect(node.get(props.value)).toBe(42)
  })

  it('устанавливает приоритет', () => {
    const { app } = NovaGraph.configureCustom({
      phases: [],
      properties: [] as const,
    })

    const node = new RaphNode(app).options({ weight: 7 })
    expect(node['computedWeight']).toBe(7) // _depth = 0
  })

  it('устанавливает и приоритет, и локальные свойства', () => {
    const { app, props } = NovaGraph.configureCustom({
      phases: [{ name: 'main', process: RaphPhase.processDirty }],
      properties: [
        {
          name: 'value',
          phase: 'main',
          compute: (n: RaphNode<TestProps>) => n.get('value') ?? 0,
        },
      ] as const,
    })

    const node = new RaphNode(app).options({
      weight: 3,
      local: { value: 100 },
    })

    app.run()

    expect(node.get(props.value)).toBe(100)
    expect(node.computedWeight).toBe(3)
  })

  it('игнорирует неизвестные свойства', () => {
    const { app } = NovaGraph.configureCustom({
      phases: [],
      properties: [] as const,
    })

    const node = new RaphNode(app).options({
      // @ts-expect-error проверка отсутствующего ключа
      local: { unknownProp: 123 },
    })

    expect(Object.keys(node['_values'])).toHaveLength(0)
  })

  it('вызывает dirty при установке значения', () => {
    let runCalled = false

    const { app } = NovaGraph.configureCustom({
      phases: [
        {
          name: 'main',
          process: (phase, root, dirty) => {
            runCalled = true
          },
        },
      ],
      properties: [
        {
          name: 'count',
          phase: 'main',
          compute: (n: RaphNode<TestProps>) => n.get('count') ?? 0,
        },
      ] as const,
    })

    const node = new RaphNode(app).options({ local: { count: 5 } })
    app.run()

    expect(runCalled).toBe(true)
    expect(node.getLocal('count')).toBe(5)
  })
})
