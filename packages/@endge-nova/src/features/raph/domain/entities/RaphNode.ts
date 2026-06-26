import type { RaphApp } from '@/features/raph/domain/entities/RaphApp'
import type { RaphProperties } from '@/features/raph/domain/types'
import { randomString } from '@/features/@utils/tools/generate'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'

export class RaphNode<P extends RaphProperties = RaphProperties> {
  //
  readonly id = randomString(5)

  _raph: RaphApp<P>
  children: RaphNode<P>[] = []
  parent: RaphNode<P> | null = null

  // Базовые свойства
  protected _depth: number = 0 // описывает глубину узла в дереве
  protected _weight: number = 0 // пользовательское значение приоритета обработки

  // Любые пользовательские свойства
  protected _values: Partial<P> = {}

  constructor(app: RaphApp<P>) {
    this._raph = app
  }

  get raph(): RaphApp<P> {
    return this._raph
  }

  options(opts: Partial<P>): RaphNode<P> {
    for (const key in opts) {
      if (key === 'weight') {
        this._weight = opts.weight!
        continue
      }

      const prop = this.raph.getProperty(key as keyof P)
      if (!prop) {
        // console.warn(`[RaphNode] Unknown property: ${key}`)
        continue
      }

      const value = opts[key]
      if (value !== undefined) {
        prop.set(this, value)
      }
    }
    return this
  }

  get computedWeight(): number {
    return this._depth * NovaGraph.WEIGHT_LIMIT + this._weight
  }

  // При превышении глубины - false
  addChild(child: RaphNode<P>): boolean {
    const newDepth = this._depth + 1
    if (newDepth >= NovaGraph.MAX_DEPTH) {
      console.warn(
        `[RaphNode] Ignored add: depth=${newDepth} exceeds MAX_DEPTH=(0-${NovaGraph.MAX_DEPTH - 1})`,
      )
      return false
    }

    child.parent = this
    child._raph = this.raph
    this.children.push(child)

    const updateDepthRecursive = (node: RaphNode<P>, depth: number) => {
      node._depth = depth
      node._raph = this.raph
      this.raph.registerNode(node)

      for (const prop of this.raph.properties.values()) {
        this.raph.dirty(prop.phase, node)
      }

      for (const ch of node.children) {
        updateDepthRecursive(ch, depth + 1)
      }
    }

    updateDepthRecursive(child, newDepth)

    return true
  }

  /** Возвращает локальное (raw) значение свойства */
  get<K extends keyof P>(key: K): P[K] {
    const prop = this.raph.getProperty(key)
    return prop.get(this)
  }

  set<K extends keyof P>(key: K, value: P[K]): void {
    const prop = this.raph.getProperty(key)
    prop.set(this, value)
  }

  /** Рекурсивно вызывает callback для себя и всех потомков */
  traverseAll(cb: (node: RaphNode<P>) => void): void {
    cb(this)
    for (const child of this.children) {
      child.traverseAll(cb)
    }
  }

  dispose(): void {
    // Рекурсивно удалить всех потомков
    for (const child of this.children) {
      child.dispose()
    }

    // Очистка ссылок на детей и родителя
    this.children.length = 0
    this.parent = null

    // Очистка ссылок на приложение
    this.raph.unregisterNode(this)
    // this.raph = null as any

    // Очистка локальных и вычисленных значений
    for (const key in this._values) {
      delete this._values[key]
    }

    // Обнуляем глубину и приоритет
    this._depth = 0
    this._weight = 0
  }
}
