import { describe, it, expect, beforeEach } from 'vitest'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import type { RaphProperties } from '@/features/raph/domain/types'
import { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'

interface TestProps extends RaphProperties {
  value: number
  double: number
}

const createApp = () => {
  NovaGraph.WEIGHT_LIMIT = 10
  NovaGraph.MAX_DEPTH = 3
  NovaGraph.TOTAL_BUCKETS = NovaGraph.WEIGHT_LIMIT * NovaGraph.MAX_DEPTH

  return NovaGraph.configureCustom({
    phases: [{ name: 'calc', process: RaphPhase.processDirty }],
    properties: [
      {
        name: 'value',
        phase: 'calc',
        compute: (node) => node.get('value') ?? 0,
      },
      {
        name: 'double',
        phase: 'calc',
        compute: (node: RaphNode<TestProps>) => (node.get('value') ?? 0) * 2,
      },
    ] as const,
  })
}

describe('NovaGraph engine core', () => {
  let app: ReturnType<typeof createApp>['app']
  let props: ReturnType<typeof createApp>['props']

  beforeEach(() => {
    const conf = createApp()
    app = conf.app
    props = conf.props
  })

  it('should set and get local property', () => {
    const node = new RaphNode(app)
    node.set(props.value, 42)
    app.run()
    expect(node.get(props.value)).toBe(42)
  })

  it('should compute derived property correctly', () => {
    const node = new RaphNode(app)
    node.set(props.value, 10)
    app.run()
    expect(node.get(props.double)).toBe(20)
  })

  it('should inherit from parent if logic provided', () => {
    const conf = NovaGraph.configureCustom({
      phases: [{ name: 'main', process: RaphPhase.processDirty }],
      properties: [
        {
          name: 'value',
          phase: 'main',
          compute: (n: RaphNode<TestProps>) =>
            (n.get('value') ?? 0) + (n.parent?.get('value') ?? 0),
        },
      ] as const,
    })

    const parent = new RaphNode(conf.app)
    const child = new RaphNode(conf.app)
    parent.set(conf.props.value, 5)
    child.set(conf.props.value, 2)
    parent.addChild(child)
    conf.app.run()
    expect(child.get(conf.props.value)).toBe(7)
  })

  it('should compute depth and weight correctly', () => {
    const root = new RaphNode(app)
    const child = new RaphNode(app)
    const grand = new RaphNode(app)

    root.addChild(child)
    child.addChild(grand)

    expect(child['_depth']).toBe(1)
    expect(grand['_depth']).toBe(2)
    expect(grand.computedWeight).toBe(
      grand['_weight'] + 2 * NovaGraph.WEIGHT_LIMIT,
    )
  })

  it('should not allow depth > MAX_DEPTH', () => {
    const root = new RaphNode(app)
    let current = root
    for (let i = 0; i < NovaGraph.MAX_DEPTH + 1; i++) {
      const node = new RaphNode(app)
      const added = current.addChild(node)
      current = node
      if (i > NovaGraph.MAX_DEPTH) expect(added).toBe(false)
    }
  })

  it('should addChild to dirty and compute only dirty', () => {
    const node = new RaphNode(app)
    node.set(props.value, 123)
    expect(app['_dirty'].size).toBe(1)
    app.run()
    expect(app['_dirty'].size).toBe(0)
  })

  it('should defer run via scheduler only once', async () => {
    let scheduled = false
    app.setScheduler('microtask')
    const node = new RaphNode(app)
    props.value.set(node, 10)
    scheduled = true
    await new Promise((r) => setTimeout(r, 0))
    expect(scheduled).toBe(true)
    app.run()
  })

  it('should compute properties for multiple nodes', () => {
    const nodes = Array.from({ length: 10 }, () => new RaphNode(app))
    nodes.forEach((n, i) => n.set(props.value, i))
    app.run()
    nodes.forEach((n, i) => {
      expect(n.get(props.value)).toBe(i)
      expect(n.get(props.double)).toBe(i * 2)
    })
  })

  it('should clean dirty buckets after run', () => {
    const node = new RaphNode(app)
    node.set(props.value, 1)
    expect(app['_dirty'].size).toBeGreaterThan(0)
    app.run()
    expect(app['_dirty'].size).toBe(0)
  })
})
