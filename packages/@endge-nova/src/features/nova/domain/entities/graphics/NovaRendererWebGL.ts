import type {
  NovaRenderer,
  NovaSchema,
  NovaRect,
  NovaLine,
  NovaCircle,
  NovaIcon,
  NovaText,
  NovaSchemaItem,
  NovaBorder,
  NovaPolygon,
} from '@/features/nova/domain/types/renderer-types'
import type { NovaCanvas } from '@/features/nova/domain/entities/graphics/NovaCanvas'
import type { NovaWebGLBatchType } from '@/features/nova/domain/entities/graphics/NovaWebGLBatch'
import { NovaWebGLBatch } from '@/features/nova/domain/entities/graphics/NovaWebGLBatch'
import { NovaWebGLShader } from '@/features/nova/domain/entities/graphics/NovaWebGLShader'
import { randomString } from '@/features/@utils/tools/generate'
import { mat3 } from 'gl-matrix'
import { NovaGraphics } from '@/features/nova/domain/entities/graphics/NovaGraphics.ts'
import { Telemetry } from '@/features/nova/domain/telemetry.ts'

// Debug временно для проверки оптимизации батчинга
export let _rectCounter = 0
export function resetRectCounter(): void {
  _rectCounter = 0
}

export class NovaRendererWebGL implements NovaRenderer {
  readonly id: string = randomString(5)
  readonly novaCanvas: NovaCanvas

  private readonly gl: WebGLRenderingContext
  private readonly _glId: string

  private readonly program: WebGLProgram
  private readonly positionBuffer: WebGLBuffer
  private readonly uTransformLocation: WebGLUniformLocation
  private readonly uResolutionLocation: WebGLUniformLocation
  private readonly uColorLocation: WebGLUniformLocation

  private transformMatrix = mat3.create()
  private matrixStack: mat3[] = []

  private batches = new Map<NovaWebGLBatchType, Map<string, NovaWebGLBatch>>()
  private _flatRects: NovaRect[] = []

  constructor(canvas: NovaCanvas) {
    this.novaCanvas = canvas
    this.gl = canvas.getContextWebGL()
    this._glId = (canvas as any)._glId ?? 'gl'

    const vsSource = `
      attribute vec2 a_position;
      uniform vec2 u_resolution;
      uniform mat3 u_transform;
      void main() {
        vec2 pos = (u_transform * vec3(a_position, 1.0)).xy;
        vec2 zeroToOne = pos / u_resolution;
        vec2 clipSpace = zeroToOne * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      }`

    const fsSource = `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }`

    this.program = NovaWebGLShader.createProgram(this.gl, vsSource, fsSource)
    if (!this.program) throw new Error('Shader program creation failed')

    this.gl.useProgram(this.program)
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
    this.uTransformLocation = this.gl.getUniformLocation(
      this.program,
      'u_transform',
    )!
    this.uResolutionLocation = this.gl.getUniformLocation(
      this.program,
      'u_resolution',
    )!
    this.uColorLocation = this.gl.getUniformLocation(this.program, 'u_color')!

    this.positionBuffer = this.gl.createBuffer()!
    this.batches.set('fill', new Map())
    this.batches.set('border', new Map())

    // setTimeout(() => {
    //   this.debugSimulate('invalid_operation')
    // }, 10000)
  }

  get canvas(): NovaCanvas {
    return this.novaCanvas
  }

  get ctx(): WebGLRenderingContext {
    return this.gl
  }

  pushSchema(schema: NovaSchema | NovaSchemaItem[]): void {
    const items = Array.isArray(schema) ? schema : [schema]

    for (const item of items) {
      if (item.active === false) continue

      if (item.type === 'rect') {
        _rectCounter++
        const hasBg = !!item.styles?.background
        const hasBorder =
          !!item.styles?.border?.color && !!item.styles?.border?.width

        if (hasBg) {
          const color = item.styles.background as string
          const batchMap = this.batches.get('fill')!
          if (!batchMap.has(color))
            batchMap.set(color, new NovaWebGLBatch(color))
          batchMap.get(color)!.add(item)
        }

        if (hasBorder) {
          const color = item.styles?.border?.color || '#000000'
          const w = item.styles?.border?.width || 1
          const position = item.styles?.border?.position || 'all'
          const borders = this._buildBorderRects(
            item.x,
            item.y,
            item.width,
            item.height,
            color,
            w,
            position,
          )

          const batchMap = this.batches.get('fill')!
          for (const b of borders) {
            if (!batchMap.has(color))
              batchMap.set(color, new NovaWebGLBatch(color))
            batchMap.get(color)!.add(b)
          }
        }
      }

      if (item.type === 'border') {
        const border = item as NovaBorder
        const color = border.styles?.color
        const w = border.styles?.width
        const position = border?.position || 'all'
        if (!color || !w) continue

        const borders = this._buildBorderRects(
          border.x,
          border.y,
          border.width,
          border.height,
          color,
          w,
          position,
        )
        const batchMap = this.batches.get('fill')!
        for (const b of borders) {
          if (!batchMap.has(color))
            batchMap.set(color, new NovaWebGLBatch(color))
          batchMap.get(color)!.add(b)
        }
      }
    }
  }

  popSchema(): void {
    const gl = this.gl
    gl.useProgram(this.program)
    gl.uniform2f(
      this.uResolutionLocation,
      this.novaCanvas.width,
      this.novaCanvas.height,
    )
    this.applyTransform()

    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    let draws = 0
    let rects = 0
    let batchesCount = 0

    const fillBatches = this.batches.get('fill')!
    batchesCount = fillBatches.size

    for (const batch of fillBatches.values()) {
      const verts: number[] = []
      for (const r of batch.rects) {
        const x1 = r.x,
          y1 = r.y,
          x2 = r.x + r.width,
          y2 = r.y + r.height
        verts.push(x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2)
      }
      rects += batch.rects.length

      const f32 = new Float32Array(verts)
      gl.bufferData(gl.ARRAY_BUFFER, f32.byteLength, gl.DYNAMIC_DRAW)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32)
      Telemetry.addUploadBytes(f32.byteLength)

      this._checkGLError('bufferData')

      const c = this._parseColor(batch.color)
      gl.uniform4f(this.uColorLocation, c.r * c.a, c.g * c.a, c.b * c.a, c.a)
      gl.drawArrays(gl.TRIANGLES, 0, batch.rects.length * 6)
      this._checkGLError('drawArrays')
      draws++
    }

    fillBatches.clear()
    this.batches.get('border')!.clear()

    // + stat в конце кадра
    const dpr = NovaGraphics.dpr()
    const backbufferBytes =
      Math.floor(this.novaCanvas.width * dpr) *
      Math.floor(this.novaCanvas.height * dpr) *
      4
    Telemetry.stat({
      g: this._glId,
      bytes: Telemetry.consumeAccBytes(),
      draws,
      rects,
      batches: batchesCount,
      backbufferBytes,
    })
  }

  private _checkGLError(where: string): void {
    const err = this.gl.getError()
    if (err !== this.gl.NO_ERROR) {
      const errName =
        err === this.gl.INVALID_ENUM
          ? 'INVALID_ENUM'
          : err === this.gl.INVALID_VALUE
            ? 'INVALID_VALUE'
            : err === this.gl.INVALID_OPERATION
              ? 'INVALID_OPERATION'
              : err === this.gl.OUT_OF_MEMORY
                ? 'OUT_OF_MEMORY'
                : err === this.gl.CONTEXT_LOST_WEBGL
                  ? 'CONTEXT_LOST_WEBGL'
                  : `UNKNOWN_${err}`

      Telemetry.event(
        'gl:error',
        { where, code: err, name: errName },
        undefined,
        this._glId,
      )
      console.warn(`[WebGL][${where}]`, errName)
    }
  }

  private _buildBorderRects(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    w: number,
    position: NovaBorder['position'] = 'all',
  ): NovaRect[] {
    const sides = new Set<string>()

    if (!position || position === 'all') {
      sides.add('top')
      sides.add('right')
      sides.add('bottom')
      sides.add('left')
    } else if (position === 'vertical') {
      sides.add('left')
      sides.add('right')
    } else if (position === 'horizontal') {
      sides.add('top')
      sides.add('bottom')
    } else if (Array.isArray(position)) {
      for (const p of position) {
        sides.add(p)
      }
    }

    const rects: NovaRect[] = []

    if (sides.has('top')) {
      rects.push({
        x,
        y,
        width,
        height: w,
        styles: { background: color },
      })
    }
    if (sides.has('right')) {
      rects.push({
        x: x + width - w,
        y,
        width: w,
        height,
        styles: { background: color },
      })
    }
    if (sides.has('bottom')) {
      rects.push({
        x,
        y: y + height - w,
        width,
        height: w,
        styles: { background: color },
      })
    }
    if (sides.has('left')) {
      rects.push({
        x,
        y,
        width: w,
        height,
        styles: { background: color },
      })
    }

    return rects
  }

  clear(): void {
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  schemaBatched(schema: NovaSchema): void {
    this.pushSchema(schema)
    this.popSchema()
  }

  schemaOrdered(schema: NovaSchema): void {
    const items = Array.isArray(schema) ? schema : [schema]
    const gl = this.gl

    gl.useProgram(this.program)
    gl.uniform2f(
      this.uResolutionLocation,
      this.novaCanvas.width,
      this.novaCanvas.height,
    )
    this.applyTransform()

    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    let draws = 0
    let rects = 0

    for (const item of items) {
      if (item.active === false) continue

      if (item.type === 'rect') {
        rects++
        const hasBg = !!item.styles?.background
        const hasBorder =
          !!item.styles?.border?.color && !!item.styles?.border?.width

        if (hasBg) {
          const color = this._parseColor(item.styles!.background!)
          draws += this._drawRectAndCount(gl, item, color)
        }

        if (hasBorder) {
          const borderColor = this._parseColor(item.styles!.border!.color!)
          const borders = this._buildBorderRects(
            item.x,
            item.y,
            item.width,
            item.height,
            item.styles!.border!.color!,
            item.styles!.border!.width!,
            item.styles!.border!.position ?? 'all',
          )

          for (const border of borders) {
            draws += this._drawRectAndCount(gl, border, borderColor)
          }
        }
      }

      if (item.type === 'border') {
        const border = item as NovaBorder
        const color = border.styles?.color
        const width = border.styles?.width
        const position = border.position ?? 'all'

        if (!color || !width) continue

        const parsedColor = this._parseColor(color)
        const borders = this._buildBorderRects(
          border.x,
          border.y,
          border.width,
          border.height,
          color,
          width,
          position,
        )

        for (const b of borders) {
          this._drawRect(gl, b, parsedColor)
        }
      }

      //
      //
      const dpr = NovaGraphics.dpr()
      const backbufferBytes =
        Math.floor(this.novaCanvas.width * dpr) *
        Math.floor(this.novaCanvas.height * dpr) *
        4
      Telemetry.stat({
        g: this._glId,
        bytes: Telemetry.consumeAccBytes(),
        draws,
        rects,
        backbufferBytes,
      })
    }
  }

  private _drawRect(
    gl: WebGLRenderingContext,
    r: { x: number; y: number; width: number; height: number },
    color: { r: number; g: number; b: number; a: number },
  ) {
    const x1 = r.x,
      y1 = r.y
    const x2 = r.x + r.width
    const y2 = r.y + r.height

    const vertices = new Float32Array([
      x1,
      y1,
      x2,
      y1,
      x1,
      y2,
      x1,
      y2,
      x2,
      y1,
      x2,
      y2,
    ])

    // gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    const f32 = new Float32Array(vertices)
    gl.bufferData(gl.ARRAY_BUFFER, f32.byteLength, gl.DYNAMIC_DRAW)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32)

    this._checkGLError('bufferData')

    const rCol = color.r * color.a
    const gCol = color.g * color.a
    const bCol = color.b * color.a

    gl.uniform4f(this.uColorLocation, rCol, gCol, bCol, color.a)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    this._checkGLError('drawArrays')
  }

  private _drawRectAndCount(
    gl: WebGLRenderingContext,
    r: { x: number; y: number; width: number; height: number },
    color: { r: number; g: number; b: number; a: number },
  ): number {
    const x1 = r.x,
      y1 = r.y,
      x2 = r.x + r.width,
      y2 = r.y + r.height
    const f32 = new Float32Array([
      x1,
      y1,
      x2,
      y1,
      x1,
      y2,
      x1,
      y2,
      x2,
      y1,
      x2,
      y2,
    ])

    gl.bufferData(gl.ARRAY_BUFFER, f32.byteLength, gl.DYNAMIC_DRAW)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f32)
    Telemetry.addUploadBytes(f32.byteLength)

    this._checkGLError('bufferData')

    gl.uniform4f(
      this.uColorLocation,
      color.r * color.a,
      color.g * color.a,
      color.b * color.a,
      color.a,
    )
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    this._checkGLError('drawArrays')
    return 1
  }

  save(): void {
    this.matrixStack.push(mat3.clone(this.transformMatrix))
  }

  restore(): void {
    if (this.matrixStack.length > 0) {
      this.transformMatrix = this.matrixStack.pop()!
      this.applyTransform()
    }
  }

  clip(x: number, y: number, width: number, height: number): void {
    const dpr = window.devicePixelRatio
    const px = x * dpr
    const py = (this.novaCanvas.height - y - height) * dpr
    const pw = width * dpr
    const ph = height * dpr

    this.gl.enable(this.gl.SCISSOR_TEST)
    this.gl.scissor(px, py, pw, ph)
  }

  clearClip(): void {
    this.gl.disable(this.gl.SCISSOR_TEST)
  }

  private applyTransform(): void {
    this.gl.useProgram(this.program)
    this.gl.uniformMatrix3fv(
      this.uTransformLocation,
      false,
      this.transformMatrix,
    )
  }

  setTransform(matrix: mat3): void {
    mat3.copy(this.transformMatrix, matrix)
    this.applyTransform()
  }

  rect(p: NovaRect): void {
    throw new Error('Not Implemented')
  }

  border(p: NovaBorder): void {
    throw new Error('Not Implemented')
  }

  line(p: NovaLine): void {
    throw new Error('Not Implemented')
  }

  circle(_p: NovaCircle): void {
    throw new Error('Not Implemented')
  }

  icon(_p: NovaIcon): void {
    throw new Error('Not Implemented')
  }

  text(_p: NovaText): void {
    throw new Error('Not Implemented')
  }

  polygon(p: NovaPolygon): void {}

  measureText(params: NovaText): { width: number; height: number } {
    throw new Error('Not Implemented')
  }

  private _parseColor(input: string): {
    r: number
    g: number
    b: number
    a: number
  } {
    if (typeof input !== 'string') return { r: 0, g: 0, b: 0, a: 1 }

    const s = input.trim()

    if (s.startsWith('#')) {
      const hex = s.slice(1)
      const toFloat = (str: string) => parseInt(str, 16) / 255

      if (hex.length === 6) {
        return {
          r: toFloat(hex.slice(0, 2)),
          g: toFloat(hex.slice(2, 4)),
          b: toFloat(hex.slice(4, 6)),
          a: 1,
        }
      }

      if (hex.length === 8) {
        return {
          r: toFloat(hex.slice(0, 2)),
          g: toFloat(hex.slice(2, 4)),
          b: toFloat(hex.slice(4, 6)),
          a: toFloat(hex.slice(6, 8)),
        }
      }
    }

    if (s.startsWith('rgba') || s.startsWith('rgb')) {
      const match = s.match(/rgba?\(([^)]+)\)/)
      if (!match) return { r: 0, g: 0, b: 0, a: 1 }

      const parts = match[1].split(',').map((x) => parseFloat(x.trim()))
      if (parts.length < 3) return { r: 0, g: 0, b: 0, a: 1 }

      const [r, g, b, a = 1] = parts

      return {
        r: r / 255,
        g: g / 255,
        b: b / 255,
        a: a,
      }
    }

    return { r: 0, g: 0, b: 0, a: 1 }
  }

  destroy(): void {
    try {
      // Отключаем использование программы
      this.gl.useProgram(null)

      // Удаляем WebGL ресурсы
      this.gl.deleteBuffer(this.positionBuffer)
      this.gl.deleteProgram(this.program)

      // Очистка ссылок
      this.batches.clear()
      this._flatRects.length = 0
      this.matrixStack.length = 0

      //
      ;(this as any).novaCanvas = undefined
    } catch (err) {
      console.error('[NovaRendererWebGL] Error during destroy:', err)
    }
  }

  cursor(value: string): void {
    this.novaCanvas.element.style.cursor = value
  }

  debugSimulate(
    kind:
      | 'invalid_enum'
      | 'invalid_value'
      | 'invalid_operation'
      | 'oom'
      | 'lost',
  ): void {
    const gl = this.gl
    const aPosLoc = gl.getAttribLocation(this.program, 'a_position')

    const safeBind = () => {
      gl.useProgram(this.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
      if (aPosLoc >= 0) {
        gl.enableVertexAttribArray(aPosLoc)
        gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0)
      }
    }

    switch (kind) {
      case 'invalid_enum': {
        gl.enable(999999)
        this._checkGLError('sim:invalid_enum')
        break
      }

      case 'invalid_value': {
        gl.enable(gl.SCISSOR_TEST)
        gl.scissor(-1, 0, 10, 10)
        this._checkGLError('sim:invalid_value')
        gl.disable(gl.SCISSOR_TEST)
        break
      }

      case 'invalid_operation': {
        gl.useProgram(null)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        this._checkGLError('sim:invalid_operation')
        safeBind()
        break
      }

      case 'oom': {
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
        const sz = Math.min(16384, max * 2)
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          sz,
          sz,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        )
        this._checkGLError('sim:oom')
        gl.deleteTexture(tex)
        break
      }

      case 'lost': {
        const lose = gl.getExtension('WEBGL_lose_context') as any
        if (lose?.loseContext) {
          lose.loseContext()
          gl.clear(gl.COLOR_BUFFER_BIT)
          this._checkGLError('sim:lost')
        }
        break
      }
    }
  }
}
