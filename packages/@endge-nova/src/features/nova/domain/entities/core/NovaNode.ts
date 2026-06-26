import { mat3, vec2 } from 'gl-matrix'
import { RaphNode } from '@/features/raph/domain/entities/RaphNode'
import { RaphPropagation } from '@/features/raph/domain/types'
import type { NovaNodeProperties } from '@/features/nova/domain/types/base-types'
import type { NovaNodeEventHandlers } from '@/features/nova/domain/types/events-types'
import type { NovaApp } from '@/features/nova/domain/entities/app/NovaApp'
import type { NovaSurface } from '@/features/nova/domain/entities/core/NovaSurface'
import { RaphAfter, RaphProperty } from '@/features/raph/domain/decorators'
import type { NovaCanvas } from '@/features/nova/domain/entities/graphics/NovaCanvas'
import type { NovaRenderer } from '@/features/nova/domain/types/renderer-types'
import type { RaphApp } from '@/features/raph/domain/entities/RaphApp'
import type { NovaEvents } from '@/features/nova/domain/entities/core/NovaEvents'
import type { NovaDebug } from '@/features/nova/domain/entities/app/NovaDebug'
import type { OneOrMany } from '@/features/@utils/tools/types'
import type { EventList } from '@/features/@utils/events/EventBus'

export class NovaNode<
  E extends EventList,
> extends RaphNode<NovaNodeProperties> {
  protected readonly _nova: NovaApp<E>
  protected readonly _surface?: NovaSurface<E>

  readonly eventHandlers: Partial<NovaNodeEventHandlers> = {}
  __type: string

  //
  // CTOR
  //

  constructor(app: NovaApp<E>, surface?: NovaSurface<E>) {
    super(app.raph)
    this._nova = app
    this._surface = surface
    this.__type = this.constructor.name
  }

  //
  // RAPH PROPERTIES - CORE
  //

  @RaphProperty({
    phase: 'update',
    default: true,
    propagation: RaphPropagation.Down,
  })
  get active(): boolean {
    return this.get('active')
  }
  set active(v: boolean) {
    if (this.active === v) return
    this.set('active', v)
  }

  @RaphProperty({ phase: 'render', default: true })
  get visible(): boolean {
    return this.get('visible')
  }
  set visible(v: boolean) {
    if (this.visible === v) return
    this.set('visible', v)
  }

  //
  // RAPH PROPERTIES - GEOMETRY
  //

  @RaphProperty({ phase: 'matrix', default: 0 })
  get x(): number {
    return this.get('x')
  }
  set x(v: number) {
    this.set('x', v)
  }

  @RaphProperty({ phase: 'matrix', default: 0 })
  get y(): number {
    return this.get('y')
  }
  set y(v: number) {
    this.set('y', v)
  }

  @RaphProperty({ phase: 'render', default: 0 })
  get width(): number {
    return this.get('width')
  }
  set width(v: number) {
    this.set('width', v)
  }

  @RaphProperty({ phase: 'render', default: 0 })
  get height(): number {
    return this.get('height')
  }
  set height(v: number) {
    this.set('height', v)
  }

  @RaphProperty({ phase: 'matrix', default: 1 })
  get scaleX(): number {
    return this.get('scaleX')
  }
  set scaleX(v: number) {
    this.set('scaleX', v)
  }

  @RaphProperty({ phase: 'matrix', default: 1 })
  get scaleY(): number {
    return this.get('scaleY')
  }
  set scaleY(v: number) {
    this.set('scaleY', v)
  }

  @RaphProperty({ phase: 'matrix', default: 0 })
  get rotation(): number {
    return this.get('rotation')
  }
  set rotation(v: number) {
    this.set('rotation', v)
  }

  @RaphProperty({
    phase: 'matrix',
    default: mat3.create(),
    propagation: RaphPropagation.Down,
    dependsOn: ['x', 'y', 'scaleX', 'scaleY', 'rotation'],
    compute: (self) => {
      if (!self.active) return mat3.create()

      const x = self.x || 0
      const y = self.y || 0
      const rot = self.rotation || 0
      const sx = self.scaleX || 1
      const sy = self.scaleY || 1

      const out = mat3.create()
      mat3.identity(out)
      if (x !== 0 || y !== 0) mat3.translate(out, out, [x, y])
      if (rot !== 0) mat3.rotate(out, out, rot)
      if (sx !== 1 || sy !== 1) mat3.scale(out, out, [sx, sy])

      const parentMatrix = self.parent?.matrix
      if (parentMatrix) mat3.multiply(out, parentMatrix, out)

      return out
    },
  })
  get matrix(): mat3 {
    return this.get('matrix')
  }

  //
  // RAPH PROPERTIES - INTERACTIVE
  //

  @RaphProperty({ phase: 'preupdate', default: false })
  get interactive(): boolean {
    return this.get('interactive')
  }
  set interactive(v: boolean) {
    if (this.visible === v) return
    this.set('interactive', v)
  }

  @RaphProperty({ phase: 'preupdate', default: false })
  get propagateUpdate(): boolean {
    return this.get('propagateUpdate')
  }
  set propagateUpdate(v: boolean) {
    this.set('propagateUpdate', v)
  }

  //
  // RAPH HANDLERS
  //

  @RaphAfter({ phase: 'update' })
  doUpdate(): void {
    if (!this.active) return

    this.debugger.startTimer('update')
    this.update()
    this.debugger.info(`${this.__type} завершил update`, 'update')
  }

  @RaphAfter({ phase: 'matrix' })
  doMatrix(): void {
    this.debugger.info(`${this.__type} завершил matrix`, 'matrix')
  }

  @RaphAfter({ phase: 'render' })
  doRender(): void {
    if (!this.visible || !this.active) return

    this.debugger.startTimer('render')

    const matrix = this.get('matrix')!

    this.renderer.save()
    this.renderer.setTransform(matrix)

    this.render()

    this.renderer.restore()
    this.debugger.info(`${this.__type} завершил render`, 'render')
  }

  //
  // BEHAVIOR
  //

  override options(
    opts: Partial<NovaNodeProperties> & { zIndex?: number },
  ): NovaNode<E> {
    const { zIndex, ...rest } = opts

    if (opts.zIndex) {
      super.options({
        ...rest,
        weight: zIndex,
      })
      return this
    }

    super.options(opts)
    return this
  }

  dirty(
    opts:
      | { matrix?: boolean; update?: boolean; render?: boolean }
      | string
      | string[],
  ): void {
    if (typeof opts === 'string') {
      this.raph.dirty(opts, this)
      return
    }

    if (Array.isArray(opts)) {
      opts.forEach((opt) => this.raph.dirty(opt, this))
      return
    }

    const { matrix, update, render } = opts
    if (update) this.raph.dirty('update', this)
    if (matrix) {
      this.raph.dirty('matrix', this)
      this.raph.dirty('render', this.surface)
      this.raph.dirty('flush', this.surface)
    }
    if (render) {
      this.raph.dirty('render', this.surface) // отрисовка всегда от корня слоя
      this.raph.dirty('flush', this.surface)
    }
  }

  containsPoint(x: number, y: number): boolean {
    const m = this.matrix

    // Обратная матрица
    const inverse = mat3.create()
    mat3.invert(inverse, m)

    // Преобразуем координаты в локальные
    const global = vec2.fromValues(x, y)
    const local = vec2.create()
    vec2.transformMat3(local, global, inverse)

    // Проверяем попадание в прямоугольник
    return (
      local[0] >= 0 &&
      local[1] >= 0 &&
      local[0] <= this.width &&
      local[1] <= this.height
    )
  }

  toLocal(gx: number, gy: number): [number, number] {
    const inverse = mat3.create()
    mat3.invert(inverse, this.matrix)
    return [
      inverse[0] * gx + inverse[3] * gy + inverse[6],
      inverse[1] * gx + inverse[4] * gy + inverse[7],
    ]
  }

  //
  // EVENTS
  //

  on<K extends keyof NovaNodeEventHandlers>(
    type: OneOrMany<K>,
    handler: NonNullable<NovaNodeEventHandlers[K]>,
  ): void {
    if (Array.isArray(type)) {
      type.forEach((t) => this.on(t, handler))
      return
    }
    this.eventHandlers[type] = handler
    this.nova.registerInteractiveNode(this)
  }

  off<K extends keyof NovaNodeEventHandlers>(type: K): void {
    delete this.eventHandlers[type]
  }

  offAll(): void {
    for (const key in this.eventHandlers) {
      delete this.eventHandlers[key as keyof NovaNodeEventHandlers]
    }
    this.nova.unregisterInteractiveNode(this)
  }

  //
  // STATE
  //

  get raph(): RaphApp<NovaNodeProperties> {
    return this._raph
  }

  get nova(): NovaApp<E> {
    return this._nova
  }

  get canvas(): NovaCanvas {
    return this.surface.canvas
  }

  get surface(): NovaSurface<E> {
    return this._surface! ?? (this as any as NovaSurface<E>)
  }

  get renderer(): NovaRenderer {
    return this.surface.renderer
  }

  get events(): NovaEvents<E> {
    return this.nova.events
  }

  get debugger(): NovaDebug {
    return this.nova.debugger
  }

  setScale(x: number, y: number): void {
    if (this.scaleX === x && this.scaleY === y) return

    this.scaleX = x
    this.scaleY = y
  }

  setRotation(angle: number): void {
    if (this.rotation === angle) return

    this.rotation = angle
  }

  setPosition(x: number, y: number): void {
    if (this.x === x && this.y === y) return

    this.x = x
    this.y = y
  }

  setSize(width: number, height: number): void {
    if (this.width === width && this.height === height) return

    this.width = width
    this.height = height
  }

  override dispose(): void {
    super.dispose()
    this.offAll()
  }

  //
  // CHILD LOGIC
  //

  render(): void {}
  update(): void {}
}
