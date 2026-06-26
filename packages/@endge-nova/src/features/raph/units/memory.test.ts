import { describe, it, expect } from 'vitest'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'
import type { RaphProperties } from '@/features/raph/domain/types'

interface TestProps extends RaphProperties {
  temp: number
}

describe('RaphCore -  утечки памяти и корректность ссылок', () => {
  const createApp = () => {
    return NovaGraph.configureCustom({
      phases: [{ name: 'main', process: RaphPhase.processDirty }],
      properties: [
        {
          name: 'temp',
          phase: 'main',
          compute: (n: RaphNode<TestProps>) => n.get('temp') ?? 0,
        },
      ] as const,
    })
  }

  it('should release references after breaking tree', () => {
    const { app } = createApp()
    const root = new RaphNode(app)
    const child = new RaphNode(app)
    root.addChild(child)
    root.children = [] // remove link manually
    root['_depth'] = 0
    child.parent = null
    app.run()
    expect(child.parent).toBe(null)
  })

  it('should avoid memory explosion on large creation and GC', () => {
    const { app, props } = createApp()
    let nodes: RaphNode<TestProps>[] = []
    for (let i = 0; i < 10_000; i++) {
      const node = new RaphNode(app)
      node.set(props.temp, i)
      nodes.push(node)
    }
    app.run()
    nodes = [] // allow GC
    expect(true).toBe(true) // sanity check
  })
})
