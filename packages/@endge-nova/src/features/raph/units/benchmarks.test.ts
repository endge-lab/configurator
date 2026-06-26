import { describe, it, expect } from 'vitest'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import type { RaphProperties } from '@/features/raph/domain/types'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'

interface TestProps extends RaphProperties {
  value: number
  computed: number
}

describe('RaphCore -  нагрузка', () => {
  const createHeavyApp = () => {
    NovaGraph.WEIGHT_LIMIT = 20
    NovaGraph.MAX_DEPTH = 10
    NovaGraph.TOTAL_BUCKETS = NovaGraph.WEIGHT_LIMIT * NovaGraph.MAX_DEPTH

    return NovaGraph.configureCustom({
      phases: [{ name: 'calc', process: RaphPhase.processDirty }],
      properties: [
        {
          name: 'value',
          phase: 'calc',
          compute: (n: RaphNode<TestProps>) => n.get('value') ?? 0,
        },
        {
          name: 'computed',
          phase: 'calc',
          compute: (n: RaphNode<TestProps>) => (n.get('value') ?? 0) * 2,
        },
      ] as const,
    })
  }

  it('should compute 10000 nodes without error', () => {
    const { app, props } = createHeavyApp()
    const nodes: RaphNode<TestProps>[] = []
    for (let i = 0; i < 10_000; i++) {
      const node = new RaphNode(app)
      node.set(props.value, i)
      nodes.push(node)
    }
    app.run()
    expect(nodes[9999].get(props.computed)).toBe(9999 * 2)
  })

  it('should build deep hierarchy to MAX_DEPTH - 1', () => {
    const { app, props } = createHeavyApp()
    const root = new RaphNode(app)
    let parent = root
    for (let i = 1; i < NovaGraph.MAX_DEPTH; i++) {
      const child = new RaphNode(app)
      parent.addChild(child)
      child.set(props.value, i)
      parent = child
    }
    app.run()
    expect(parent.get(props.computed)).toBe((NovaGraph.MAX_DEPTH - 1) * 2)
  })

  it('should avoid overflow when dirtying all nodes', () => {
    const { app, props } = createHeavyApp()
    const nodes = Array.from({ length: 5000 }, () => new RaphNode(app))
    nodes.forEach((n, i) => n.set(props.value, i))
    app.run()
    expect(app['_dirty'].size).toBe(0)
  })
})
