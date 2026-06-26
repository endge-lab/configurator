import { NovaSurface } from '@/features/nova/domain/entities/core/NovaSurface'
import { NovaRenderer2D } from '@/features/nova/domain/entities/graphics/NovaRenderer2D'
import type {
  NovaAppOptions,
  NovaNodeProperties,
} from '@/features/nova/domain/types/base-types'
import type { NovaNodeEventHandlers } from '@/features/nova/domain/types/events-types'
import { CanvasDomEvents } from '@/features/nova/domain/types/events-types'
import { NovaStore } from '@/features/nova/domain/entities/core/NovaStore'
import type { EventList } from '@/features/@utils/events/EventBus'
import { EventBus } from '@/features/@utils/events/EventBus'
import { NovaCanvas } from '@/features/nova/domain/entities/graphics/NovaCanvas'
import { RendererType } from '@/features/nova/domain/types/renderer-types'
import type { RaphApp } from '@/features/raph/domain/entities/RaphApp'
import {
  type RaphPhaseContext,
  RaphSchedulerType,
} from '@/features/raph/domain/types'
import { NovaGraph } from '@/features/raph/domain/entities/NovaGraph'
import { NovaNode } from '@/features/nova/domain/entities/core/NovaNode'
import { RaphPhase } from '@/features/raph/domain/decorators'
import { NovaEvents } from '@/features/nova/domain/entities/core/NovaEvents'
import { NovaDebug } from '@/features/nova/domain/entities/app/NovaDebug'
import type { RaphNode } from '@/features/raph/domain/entities/RaphNode'

export class NovaApp<E extends EventList = Record<string, any>> {
  // Ядро
  private readonly _raph: RaphApp<NovaNodeProperties>
  private readonly _canvas: NovaCanvas
  private readonly _renderer: NovaRenderer2D
  private readonly _events: NovaEvents<E>

  readonly store = new NovaStore()
  readonly bus: EventBus<E>

  // NovaAppOptions
  private _debug: boolean | string | string[] = false

  // Системные
  __tasks = 0
  __groups = 0
  private __lastDebugLogTimes: Map<string, number> = new Map()
  private readonly __debugger = new NovaDebug()

  //
  // CTOR
  //

  constructor(canvasId: string, predefinedEvents: (keyof E)[] = []) {
    // Инициализация холста
    const domCanvas = document.getElementById(canvasId) as HTMLCanvasElement
    if (!domCanvas) throw new Error(`Canvas with id=${canvasId} not found`)

    this._canvas = NovaCanvas.attach(domCanvas)
    this._renderer = new NovaRenderer2D(this._canvas)
    this._events = new NovaEvents(this)

    this.bus = new EventBus<E>(predefinedEvents)

    // events
    this.setupEventListeners()

    // NovaGraph core
    const conf = NovaGraph.configure<NovaNodeProperties, NovaApp<E>, NovaNode<E>>(
      () => this,
      () => new NovaNode(this),
    )
    this._raph = conf.app
    this.raph.setScheduler(RaphSchedulerType.AnimationFrame)
    this.raph.init()
    this.raph.invalidate()
  }

  //
  // RAPH CORE
  //
  @RaphPhase({ name: 'before', priority: -1, always: true })
  before(): void {
    this.__debugger.frameStart()
  }

  @RaphPhase({ name: 'preupdate', priority: 0 })
  preupdate(p: RaphPhaseContext<NovaNodeProperties>): void {
    this.__debugger.phaseStart('preupdate')
    NovaGraph.processDirtyNodes({ payload: p })
    this.__debugger.phaseEnd()
  }

  @RaphPhase({ name: 'update', priority: 1 })
  update(p: RaphPhaseContext<NovaNodeProperties>): void {
    this.__debugger.phaseStart('update')
    NovaGraph.processDirtyNodes({ payload: p })
    this.__debugger.phaseEnd()
  }

  @RaphPhase({ name: 'matrix', priority: 2 })
  matrix(p: RaphPhaseContext<NovaNodeProperties>): void {
    this.__debugger.phaseStart('matrix')
    NovaGraph.processDirtyNodes({ payload: p })
    this.__debugger.phaseEnd()
  }

  @RaphPhase({ name: 'render', priority: 3, mode: 'dirty' })
  render(p: RaphPhaseContext<NovaNodeProperties>): void {
    this.__debugger.phaseStart('render')
    // ToDo: найти вариант traverseAll с учетом иерархии
    // Сейчас processDirtyNodes - риск нарваться на ошибку программиста, когда
    // он сделает грязными не root surface узлы (тогда отрисовка будет кусками)
    NovaGraph.processDirtyNodes({ payload: p, ignoreCompute: true })
    this.__debugger.phaseEnd()
  }

  @RaphPhase({ name: 'flush', priority: 4 })
  flush(): void {
    this.__debugger.phaseStart('flush')

    const ctx = this.canvas.getContext2D()!
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (const surface of this.surfaces) {
      surface.doFlush(ctx)
    }

    if (this._debug) {
      this._renderer.schema([
        {
          type: 'text',
          text: `${!this.raph.loopEnabled ? 'LAST ' : ''}FPS: ${this.raph.UPS.toFixed(0)} (Задач: ${this.__tasks}, Групп: ${this.__groups})`,
          x: this.width - 300,
          y: 5,
          width: 300,
          height: 10,
          styles: {
            ellipsis: true,
            align: { horizontal: 'center', vertical: 'middle' },
            font: { family: 'monospace', size: 10 },
          },
        },
      ])
    }

    this.__debugger.phaseEnd()
  }

  @RaphPhase({ name: 'after', priority: 10, always: true })
  after(): void {
    this.__debugger.frameEnd()
  }

  // При наличии изменений запустит нужные фазы у нужных узлов.
  // (Сам по себе не несет нагрузки, если нет изменений)
  invalidate(): void {
    this.raph.invalidate()
  }

  startLoop(): void {
    this.raph.startLoop()
  }

  stopLoop(): void {
    this.raph.stopLoop()
  }

  options(opts: Partial<NovaAppOptions>): void {
    if (opts.debug !== undefined) {
      this._debug = opts.debug
      this.__debugger.enabled = opts.debug === true
    }

    if (opts.loop !== undefined && opts.loop !== this.raph.loopEnabled) {
      if (!this.raph.loopEnabled) {
        this.startLoop()
      } else {
        this.stopLoop()
      }
    }

    if (opts.width !== undefined || opts.height !== undefined) {
      this.resize(opts.width, opts.height)
    }
  }

  handleEvent(type: keyof NovaNodeEventHandlers, event: Event): void {
    this._events.handle(type, event)
  }

  //
  // PROPERTIES
  //

  get raph(): RaphApp<NovaNodeProperties> {
    return this._raph
  }

  get canvas(): NovaCanvas {
    return this._canvas
  }

  get renderer(): NovaRenderer2D {
    return this._renderer
  }

  get events(): NovaEvents<E> {
    return this._events
  }

  get surfaces(): NovaSurface<E>[] {
    return this.raph.root.children as unknown as NovaSurface<E>[]
  }

  get debugger(): NovaDebug {
    return this.__debugger
  }

  get width(): number {
    return this.raph.root.get('width')
  }

  get height(): number {
    return this.raph.root.get('height')
  }

  //
  // STATE
  //

  createSurface2D<T extends NovaSurface<E>>(
    name: string,
    SurfaceClass: new (...args: any[]) => T = NovaSurface<E> as any,
    ...args: any[]
  ): T {
    const surface = new SurfaceClass(name, this, RendererType.Web2D, ...args)
    return this.addSurface(surface)
  }

  createSurfaceWebGL<T extends NovaSurface<E>>(
    name: string,
    SurfaceClass: new (...args: any[]) => T = NovaSurface as any,
    ...args: any[]
  ): T {
    const surface = new SurfaceClass(name, this, RendererType.WebGL, ...args)
    return this.addSurface(surface)
  }

  addSurface<T extends NovaSurface<E>>(surface: T): T {
    // Применяем базовые размеры.
    surface.options({
      width: this.width,
      height: this.height,
    })

    // Добавляем в RaphGraph
    this.raph.addNode(surface as unknown as RaphNode<NovaNodeProperties>)
    this.invalidate()

    return surface
  }

  registerInteractiveNode(node: NovaNode<E>): void {
    this._events.interactiveNodes.add(node)
  }

  unregisterInteractiveNode(node: NovaNode<E>): void {
    this._events.interactiveNodes.delete(node)
  }

  resize(width?: number, height?: number): void {
    const root = this.raph.root!

    const newWidth = width ?? root.get('width') ?? 0
    const newHeight = height ?? root.get('height') ?? 0

    root.set('width', newWidth)
    root.set('height', newHeight)

    this._canvas.resize(newWidth, newHeight)

    for (const surface of this.surfaces) {
      surface.options({ width: newWidth, height: newHeight })
      surface.dirty({ update: true, matrix: true, render: true })
    }

    this.raph.invalidate()
  }

  destroy(): void {
    // Снимаем события с canvas
    for (const [domEvent, handler] of Object.entries(this._boundCanvasEvents)) {
      this._canvas.element.removeEventListener(domEvent, handler)
    }

    // Снимаем события с окна
    for (const [domEvent, handler] of Object.entries(this._boundWindowEvents)) {
      window.removeEventListener(domEvent, handler)
    }

    this.bus.offAll()

    this.stopLoop()

    this._canvas.destroy()
    for (const surface of this.surfaces) {
      surface.destroy()
    }
  }

  //
  // SYSTEM
  //

  private _boundWindowEvents: Record<string, (e: Event) => void> = {}
  private _boundCanvasEvents: Record<string, (e: Event) => void> = {}

  private setupEventListeners(): void {
    for (const domEvent of CanvasDomEvents) {
      const handler = (e: Event) =>
        this.handleEvent(domEvent as keyof NovaNodeEventHandlers, e)
      this._boundCanvasEvents[domEvent] = handler
      this._canvas.element.addEventListener(domEvent, handler)
    }

    for (const domEvent of ['mouseenter', 'mouseleave', 'keydown', 'keyup']) {
      const handler = (e: Event) =>
        this.handleEvent(domEvent as keyof NovaNodeEventHandlers, e)
      this._boundWindowEvents[domEvent] = handler
      window.addEventListener(domEvent, handler)
    }
  }
}
