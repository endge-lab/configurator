import type {
  RaphPhaseName,
  RaphProperties,
  RaphScheduler,
} from '@/features/raph/domain/types'
import { RaphSchedulerType } from '@/features/raph/domain/types'
import { RaphPropagation } from '@/features/raph/domain/types'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import type { RaphPhase } from '@/features/raph/domain/entities/RaphPhase'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import type { RaphProperty } from '@/features/raph/domain/entities/RaphProperty'

export class RaphApp<Props extends RaphProperties = RaphProperties> {
  // Планировщик для запуска фаз
  private _scheduler: RaphScheduler = (cb) => queueMicrotask(cb)
  private _schedulerType: RaphSchedulerType = RaphSchedulerType.Microtask
  private _schedulerPending = false
  private _ready = false

  //
  protected _root: RaphNode<Props>
  protected _nodesById: Map<string, RaphNode<Props>>
  protected _dirty: Map<RaphPhaseName, Array<Set<RaphNode<Props>>>>
  protected _properties: Map<keyof Props & string, RaphProperty<Props, any>>
  protected _phases: Map<RaphPhaseName, RaphPhase<Props>>
  protected _phaseOrder: RaphPhaseName[]

  //
  //
  private __ups = 0
  private __lastUPSUpdate = performance.now()
  private __upsCount = 0
  private __isLoopActive = false
  private __lastTime = performance.now()
  private __animationFrameId: number | null = null
  private __upsResetTimeout: number | null = null

  constructor() {
    this._root = new RaphNode(this)
    this._nodesById = new Map<string, RaphNode<Props>>()
    this._dirty = new Map()
    this._properties = new Map()
    this._phases = new Map()
    this._phaseOrder = []
  }

  // Количество обновлений в секунду (активно при включенном цикле)
  get UPS(): number {
    return this.__ups
  }

  get root(): RaphNode<Props> {
    return this._root
  }

  get properties(): Map<keyof Props & string, RaphProperty<Props, any>> {
    return this._properties
  }

  get phases(): Map<RaphPhaseName, RaphPhase<Props>> {
    return this._phases
  }

  get loopEnabled(): boolean {
    return this.__isLoopActive
  }

  init(): void {
    if (this._ready) {
      console.warn('[RaphApp] Already initialized, skipping.')
      return
    }
    // root node будет "грязным" для инициализации
    this.registerNode(this._root)
    for (const prop of this._properties.values()) {
      this.dirty(prop.phase, this._root)
    }

    // Завершить настройку всех фаз
    for (const phase of this._phases.values()) {
      phase.finalize()
    }

    this._ready = true
  }

  addProperty<K extends keyof Props>(property: RaphProperty<Props, K>): void {
    this._properties.set(property.name as string, property)

    const phase = this._phases.get(property.phase)
    if (!phase) {
      throw new Error(
        `[RaphApp] Phase "${property.phase}" not found for property "${String(property.name)}"`,
      )
    }

    phase.addProperty(property)
  }

  getProperty<K extends keyof Props>(key: K): RaphProperty<Props, K> {
    return this._properties.get(key as string) as RaphProperty<Props, K>
  }

  addNode(node: RaphNode<Props>): boolean {
    return this._root.addChild(node)
  }

  getNode(id: string): RaphNode<Props> | undefined {
    return this._nodesById.get(id)
  }

  registerNode(node: RaphNode<Props>): void {
    this._nodesById.set(node.id, node)
  }

  unregisterNode(node: RaphNode<Props>): void {
    this._nodesById.delete(node.id)
  }

  /** Рекурсивно вызывает callback для себя и всех потомков */
  traverseAll(cb: (node: RaphNode<Props>) => void): void {
    this._root.traverseAll(cb)
  }

  setScheduler(mode: RaphSchedulerType): void {
    if (mode === RaphSchedulerType.Microtask) {
      this._scheduler = (cb) => queueMicrotask(cb)
    } else {
      this._scheduler = (cb) => requestAnimationFrame(cb)
    }
    this._schedulerType = mode
  }

  addPhase(phase: RaphPhase<Props>): void {
    if (!this._phases.has(phase.name)) {
      this._phaseOrder.push(phase.name)
    }
    this._phases.set(phase.name, phase)
  }

  getPhase(name: RaphPhaseName): RaphPhase<Props> | undefined {
    return this._phases.get(name)
  }

  dirty(phase: RaphPhaseName, node: RaphNode<Props>): void {
    if (!this._phases.has(phase)) {
      console.warn(
        `[RaphApp] Phase "${phase}" is not registered and cannot be marked dirty.`,
      )
      return
    }

    const index = node.computedWeight
    if (index < 0 || index >= NovaGraph.TOTAL_BUCKETS) {
      console.warn('[RaphNode]: Invalid weight', node.computedWeight, node)
      return
    }

    let phaseBuckets = this._dirty.get(phase)
    if (!phaseBuckets) {
      phaseBuckets = Array.from({ length: NovaGraph.TOTAL_BUCKETS }, () => new Set())
      this._dirty.set(phase, phaseBuckets)
    }

    phaseBuckets[index].add(node)
    this.invalidate()
  }

  run(): void {
    if (!this._ready) {
      console.warn('[RaphApp] Not initialized, skipping run.')
      return
    }

    const now = performance.now()
    this.__upsCount++
    if (now - this.__lastUPSUpdate >= 1000) {
      this.__ups = this.__upsCount
      this.__upsCount = 0
      this.__lastUPSUpdate = now
    }

    // Сброс UPS, если активность прекратилась
    if (!this.loopEnabled) {
      if (this.__upsResetTimeout !== null) {
        clearTimeout(this.__upsResetTimeout)
      }
      this.__upsResetTimeout = window.setTimeout(() => {
        this.__ups = 0
        this.__upsResetTimeout = null
      }, 1500)
    }

    for (const phaseName of this._phaseOrder) {
      const phase = this._phases.get(phaseName)
      if (!phase) continue

      const buckets = this._dirty.get(phaseName)
      const runAnyway = phase.always
      const hasDownPropagation = phase.properties.some(
        (p) => p.propagation === RaphPropagation.Down,
      )

      if (!buckets && !runAnyway) continue

      // собираем dirty-узлы
      const seen = new Set<RaphNode<Props>>()
      const dirty: RaphNode<Props>[] = []

      if (buckets) {
        if (phase.mode === 'all') {
          // Просто добавляем всё дерево в правильной последовательности
          this.traverseAll((node) => {
            dirty.push(node)
          })
        } else {
          for (let i = 0; i < NovaGraph.TOTAL_BUCKETS; i++) {
            for (const node of buckets[i]) {
              if (seen.has(node)) continue

              // если propagation down -  сразу добавляем всех потомков
              const collect = (n: RaphNode<Props>) => {
                if (seen.has(n)) return
                seen.add(n)
                dirty.push(n)
                if (hasDownPropagation) {
                  for (const child of n.children) collect(child)
                }
              }

              collect(node)
            }
          }
        }
      }

      // если фаза always -  запускаем root
      if (runAnyway && dirty.length === 0) {
        dirty.push(this._root)
      }

      // теперь dirty содержит все ноды, иерархия уже учтена
      phase.run({
        phase,
        root: this._root,
        dirty: dirty,
      })
    }

    this._dirty.clear()
  }

  startLoop(): void {
    if (this.__isLoopActive) return
    this.__isLoopActive = true

    const loop = (time: number): void => {
      if (!this.__isLoopActive) return

      this.invalidate()

      if (this._schedulerType === RaphSchedulerType.AnimationFrame) {
        this.__animationFrameId = requestAnimationFrame(loop)
      } else {
        queueMicrotask(() => loop(performance.now()))
      }
    }

    loop(this.__lastTime)
  }

  stopLoop(): void {
    this.__isLoopActive = false
    this.__ups = 0
    if (this.__animationFrameId !== null) {
      cancelAnimationFrame(this.__animationFrameId)
      this.__animationFrameId = null
    }
    if (this.__upsResetTimeout !== null) {
      clearTimeout(this.__upsResetTimeout)
      this.__upsResetTimeout = null
    }
  }

  invalidate(): void {
    if (this._schedulerPending) return

    this._schedulerPending = true
    this._scheduler(() => {
      this._schedulerPending = false
      this.run()
    })
  }

  clear(): void {
    // Удаляем всех потомков root-ноды
    this._root.traverseAll((node) => {
      if (node !== this._root) {
        node.dispose()
      }
    })

    this._root.children.length = 0

    // Очищаем все фазы и связанные структуры
    this._phases.clear()
    this._phaseOrder.length = 0
    this._dirty.clear()

    // Очищаем root'у все локальные и вычисленные значения
    for (const key in this._root['_values']) {
      delete this._root['_values'][key]
    }

    this._root['_depth'] = 0
    this._root['_weight'] = 0
  }
}
