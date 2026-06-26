import type { NovaApp } from '@/features/nova/domain/entities/app/NovaApp'
import { NovaCanvas } from '@/features/nova/domain/entities/graphics/NovaCanvas'
import { NovaRenderer2D } from '@/features/nova/domain/entities/graphics/NovaRenderer2D'
import { NovaRendererWebGL } from '@/features/nova/domain/entities/graphics/NovaRendererWebGL'
import {
  RendererType,
  type NovaRenderer,
} from '@/features/nova/domain/types/renderer-types'
import type { NovaNodeProperties } from '@/features/nova/domain/types/base-types'
import { NovaGraphics } from '@/features/nova/domain/entities/graphics/NovaGraphics'
import { NovaNode } from '@/features/nova/domain/entities/core/NovaNode'
import type { ConstructorOrFactory } from '@/features/@utils/tools/reflect'
import { createInstance } from '@/features/@utils/tools/reflect'
import type { EventList } from '@/features/@utils/events/EventBus'

export class NovaSurface<E extends EventList> extends NovaNode<E> {
  readonly name: string

  private readonly _canvas: NovaCanvas
  private readonly _renderer: NovaRenderer

  protected _dirty: boolean = false

  private readonly _type: RendererType
  private readonly _app: NovaApp<E>

  constructor(name: string, app: NovaApp<E>, type: RendererType) {
    super(app)
    this.name = name
    this._type = type
    this._app = app

    this._canvas = NovaCanvas.create(app.width, app.height, type)
    this._renderer =
      type === RendererType.Web2D
        ? new NovaRenderer2D(this._canvas)
        : new NovaRendererWebGL(this._canvas)

    this._subscribeToCanvasContextEvents()

    // Устанавливаем логические размеры (логическая система координат)
    this.options({
      width: app.width,
      height: app.height,
    })
  }

  override options(opts: Partial<NovaNodeProperties>): NovaSurface<E> {
    const { width, height } = opts

    if (width && height) {
      this._canvas.resize(width, height)
      this.width = width
      this.height = height
    }

    super.options(opts)
    return this
  }

  // Помимо базовой отрисовки в локальных координатах,
  // Очищаем второй буфер
  doRender(): void {
    this.renderer.clear()
    super.doRender()
    this.children.forEach((child) => {
      if (child instanceof NovaNode) {
        child.doRender()
      }
    })
  }

  doFlush(mainCtx: CanvasRenderingContext2D): void {
    this.flush(mainCtx)
  }

  flush(mainCtx: CanvasRenderingContext2D): void {
    mainCtx.drawImage(
      this.canvas.element,
      0,
      0,
      this.canvas.width * NovaGraphics.dpr(),
      this.canvas.height * NovaGraphics.dpr(),
      this.x,
      this.y,
      this.width,
      this.height,
    )
  }

  destroy(): void {
    this._renderer?.destroy()
    this._canvas?.destroy()
  }

  //
  // STATE
  //

  createNode<T extends NovaNode<E>>(
    NodeClassOrFactory?: ConstructorOrFactory<
      T,
      [NovaApp<E>, NovaSurface<E>, ...any[]]
    >,
    ...args: any[]
  ): T {
    const node: T = NodeClassOrFactory
      ? createInstance(NodeClassOrFactory, this._nova, this, ...args)
      : (new NovaNode<E>(this._nova, this) as T)

    this.addChild(node)

    return node
  }

  private _recreateCanvasAndRenderer(): void {
    console.warn(`[NovaSurface:${this.name}] Recreating canvas and renderer`)

    //
    this._renderer.destroy()
    this._canvas.destroy()

    // Создаём новый канвас и рендерер
    const newCanvas = NovaCanvas.create(
      this._app.width,
      this._app.height,
      this._type,
    )
    const newRenderer =
      this._type === RendererType.Web2D
        ? new NovaRenderer2D(newCanvas)
        : new NovaRendererWebGL(newCanvas)

    // Подписываемся на события снова
    newCanvas.onContextLost(() => {
      this._recreateCanvasAndRenderer()
    })

    // Обновляем ссылки
    ;(this as any)._canvas = newCanvas
    ;(this as any)._renderer = newRenderer

    // Восстанавливаем размеры
    this.options({
      width: this._app.width,
      height: this._app.height,
    })

    this._dirty = true
  }

  //
  // CONTEXT
  //

  private _subscribeToCanvasContextEvents(): void {
    this._canvas.onContextLost(() => {
      this._recreateCanvasAndRenderer()
    })
  }

  //
  // ACCESS
  //

  get canvas(): NovaCanvas {
    return this._canvas
  }

  get renderer(): NovaRenderer {
    return this._renderer
  }
}
