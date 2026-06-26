import { NovaGraphics } from '@/features/nova/domain/entities/graphics/NovaGraphics'
import { RendererType } from '@/features/nova/domain/types/renderer-types'
import { Telemetry } from '@/features/nova/domain/telemetry.ts'

export class NovaCanvas {
  private readonly _element!: HTMLCanvasElement
  private _ctx2D?: CanvasRenderingContext2D
  private _ctxWebGL?: WebGLRenderingContext
  private _cachedRect?: DOMRectReadOnly

  private _handlersInited = false
  private _destroyed = false

  private _glId?: string

  private _isContextLost = false
  private _onContextLostCallback?: () => void
  private _onContextRestoredCallback?: () => void

  private constructor(canvas: HTMLCanvasElement) {
    this._element = canvas
  }

  get element(): HTMLCanvasElement {
    return this._element
  }

  get width(): number {
    return this._element.width / NovaGraphics.dpr()
  }

  get height(): number {
    return this._element.height / NovaGraphics.dpr()
  }

  getBoundingClientRect(): DOMRectReadOnly {
    if (!this._cachedRect) {
      this._cachedRect = this._element.getBoundingClientRect()
    }
    return this._cachedRect
  }

  invalidate(): void {
    this._cachedRect = undefined
  }

  resize(width: number, height: number): void {
    const dpr = NovaGraphics.dpr()
    this._element.width = width * dpr
    this._element.height = height * dpr
    this._element.style.width = `${width}px`
    this._element.style.height = `${height}px`

    if (this._glId) Telemetry.event('canvas:resize', { w: width, h: height, dpr }, undefined, this._glId)

    if (this._ctx2D) {
      this._ctx2D.setTransform(1, 0, 0, 1, 0, 0)
      this._ctx2D.scale(dpr, dpr)
      this._ctx2D.imageSmoothingEnabled = false
    }
    if (this._ctxWebGL) {
      this._ctxWebGL.viewport(0, 0, this._element.width, this._element.height)
    }
  }

  getContext2D(): CanvasRenderingContext2D {
    if (!this._ctx2D) {
      const ctx = this._element.getContext(RendererType.Web2D)
      if (!ctx) throw new Error('2D context not supported')
      this._ctx2D = ctx
      this._ctx2D.scale(NovaGraphics.dpr(), NovaGraphics.dpr())
      this._ctx2D.imageSmoothingEnabled = false
    }
    return this._ctx2D
  }

  getContextWebGL(): WebGLRenderingContext {
    if (!this._ctxWebGL) {
      const attrs: WebGLContextAttributes = { alpha: true, antialias: true }
      const ctx =
        (this._element.getContext(RendererType.WebGL, attrs) as WebGLRenderingContext | null) ||
        (this._element.getContext(RendererType.WebGLExperimental, attrs) as WebGLRenderingContext | null)
      if (!ctx) throw new Error('WebGL context not supported')
      this._ctxWebGL = ctx

      //
      //
      this._glId = this._glId ?? `gl_${Math.random().toString(36).slice(2)}`
      Telemetry.event(
        'ctx:create',
        {
          w: this.width,
          h: this.height,
          dpr: NovaGraphics.dpr(),
          attrs,
        },
        undefined,
        this._glId,
      )

      //
      this._element.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        this._isContextLost = true
        this._ctxWebGL = undefined
        Telemetry.event('ctx:lost', {}, undefined, this._glId)
        Telemetry.snapshot('lost')

        this._onContextLostCallback?.()
      })
      this._element.addEventListener('webglcontextrestored', () => {
        this._isContextLost = false
        this._ctxWebGL = undefined
        Telemetry.event('ctx:restored', {}, undefined, this._glId)
        this._onContextRestoredCallback?.()
      })
    }
    return this._ctxWebGL
  }

  destroy(): void {
    if (this._destroyed) return
    this._destroyed = true

    if (this._glId) Telemetry.event('ctx:destroy', {}, undefined, this._glId)

    if (this._handlersInited) {
      this._element.removeEventListener('webglcontextlost', this._handleContextLost)
      this._element.removeEventListener('webglcontextrestored', this._handleContextRestored)
      this._handlersInited = false
    }

    //
    try {
      if (this._ctxWebGL) {
        const loseCtx = this._ctxWebGL.getExtension('WEBGL_lose_context')
        loseCtx?.loseContext()
      }

      this._element.width = 0
      this._element.height = 0
    } catch {
      /* ignore */
    }

    //
    //
    const parent = this._element.parentNode
    if (parent) parent.removeChild(this._element)

    //
    this._onContextLostCallback = undefined
    this._onContextRestoredCallback = undefined
    this._isContextLost = false
    ;(this as any)._ctx2D = undefined
    ;(this as any)._ctxWebGL = undefined
    ;(this as any)._cachedRect = undefined
    ;(this as any)._element = undefined
  }

  public onContextLost(callback: () => void): void {
    this._onContextLostCallback = callback
  }

  public onContextRestored(callback: () => void): void {
    this._onContextRestoredCallback = callback
  }

  public isContextLost(): boolean {
    return this._isContextLost
  }

  static create(width: number, height: number, contextType: RendererType): NovaCanvas {
    const canvas = document.createElement('canvas')
    const instance = new NovaCanvas(canvas)
    instance.resize(width, height)

    instance.initContextLossHandlers()

    if (contextType === RendererType.Web2D) {
      instance.getContext2D()
    } else if (contextType === RendererType.WebGL) {
      instance.getContextWebGL()
    } else {
      throw new Error(`Unsupported context type: ${contextType}`)
    }

    return instance
  }

  static attach(canvas: HTMLCanvasElement): NovaCanvas {
    const instance = new NovaCanvas(canvas)
    instance.getContext2D()
    return instance
  }

  private initContextLossHandlers(): void {
    if (this._handlersInited) {
      return
    }
    this._handlersInited = true

    this._element.addEventListener('webglcontextlost', this._handleContextLost, false)
    this._element.addEventListener('webglcontextrestored', this._handleContextRestored, false)
  }

  private _handleContextLost = (e: Event): void => {
    e.preventDefault()
    this._isContextLost = true
    this._ctxWebGL = undefined
    this._onContextLostCallback?.()
  }

  private _handleContextRestored = (_e: Event): void => {
    this._isContextLost = false
    this._ctxWebGL = undefined // нужно будет получить заново через getContextWebGL()
    this._onContextRestoredCallback?.()
  }
}
