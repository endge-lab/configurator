import type { RaphProperties } from '@/features/raph/domain/types'
import type { RaphPropagation } from '@/features/raph/domain/types'
import type { RaphNode } from '@/features/raph/domain/entities/RaphNode'

export class RaphProperty<P extends RaphProperties, K extends keyof P> {
  //
  constructor(
    public readonly name: K,
    public readonly phase: string,
    public readonly propagation: RaphPropagation,
    private readonly compute: (node: RaphNode<P>) => P[K],
    public readonly dependsOn?: (keyof P)[],
    public readonly defaultValue?: P[K],
  ) {}

  set(node: RaphNode<P>, value: P[K]): void {
    node['_values'][this.name] = value
    node.raph.dirty(this.phase, node)
  }

  get(node: RaphNode<P>): P[K] {
    return (node['_values'][this.name] || this.defaultValue) as P[K]
  }

  computeOn(node: RaphNode<P>): void {
    node['_values'][this.name] = this.compute(node)
  }
}
