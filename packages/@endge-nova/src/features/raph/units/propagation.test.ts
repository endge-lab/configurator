import { describe, it, expect } from 'vitest'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import type { RaphProperties } from '@/features/raph/domain/types'
import { RaphPropagation } from '@/features/raph/domain/types'

interface TestProps extends RaphProperties {
  value: number
  inherited: number
}

describe('RaphCore -  propagation modes', () => {
  const configureApp = (propagation: RaphPropagation) => {
    return NovaGraph.configureCustom({
      phases: [{ name: 'main', process: RaphPhase.processDirty }],
      properties: [
        {
          name: 'value',
          phase: 'main',
          compute: (n: RaphNode<TestProps>) => n.get('value') ?? 0,
        },
        {
          name: 'inherited',
          phase: 'main',
          propagation,
          dependsOn: ['value'],
          compute: (n: RaphNode<TestProps>) =>
            (n.get('value') ?? 0) + (n.parent?.get('value') ?? 0),
        },
      ] as const,
    })
  }

  it('should update child if parent changes with Propagation.Down', () => {
    const { app, props } = configureApp(RaphPropagation.Down)
    const parent = new RaphNode(app)
    const child = new RaphNode(app)
    parent.addChild(child)

    parent.set(props.value, 10)
    child.set(props.value, 5)
    app.run()

    expect(child.get(props.inherited)).toBe(15)

    parent.set(props.value, 20)
    app.run()

    expect(child.get(props.inherited)).toBe(25) // propagation обновил потомка
  })

  it('should NOT update child if parent changes with Propagation.None', () => {
    const { app, props } = configureApp(RaphPropagation.None)
    const parent = new RaphNode(app)
    const child = new RaphNode(app)
    parent.addChild(child)

    parent.set(props.value, 10)
    child.set(props.value, 5)
    app.run()

    expect(child.get(props.inherited)).toBe(15)

    // теперь меняем только родителя -  без propagation потомок не обновится
    parent.set(props.value, 20)
    app.run()

    expect(child.get(props.inherited)).toBe(15) // значение осталось старым
  })

  it('should update only changed node in Propagation.None', () => {
    const { app, props } = configureApp(RaphPropagation.None)
    const parent = new RaphNode(app)
    const child = new RaphNode(app)
    parent.addChild(child)

    parent.set(props.value, 100)
    child.set(props.value, 10)
    app.run()

    expect(parent.get(props.inherited)).toBe(100)
    expect(child.get(props.inherited)).toBe(110)

    // изменим только child
    child.set(props.value, 20)
    app.run()

    expect(child.get(props.inherited)).toBe(120)
    expect(parent.get(props.inherited)).toBe(100) // родитель не изменился
  })
})
