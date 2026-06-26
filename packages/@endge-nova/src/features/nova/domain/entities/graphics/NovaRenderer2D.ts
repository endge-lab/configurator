import type { NovaCanvas } from '@/features/nova/domain/entities/graphics/NovaCanvas'
import type {
  NovaBorder,
  NovaCircle,
  NovaIcon,
  NovaLine,
  NovaPolygon,
  NovaRect,
  NovaRenderer,
  NovaSchema,
  NovaText,
  NovaTextChunk,
} from '@/features/nova/domain/types/renderer-types'
import { randomString } from '@/features/@utils/tools/generate'
import type { mat3 } from 'gl-matrix'
import { NovaGraphics } from '@/features/nova/domain/entities/graphics/NovaGraphics'

// TODO:
let _CANVAS2D_TEMP_MODE = false

export function CANVAS2D_TEMP_MODE(value: boolean): void {
  _CANVAS2D_TEMP_MODE = value
}

export class NovaRenderer2D implements NovaRenderer {
  readonly id: string = randomString(5)
  readonly novaCanvas: NovaCanvas

  constructor(canvas: NovaCanvas) {
    this.novaCanvas = canvas
  }

  get ctx(): CanvasRenderingContext2D {
    return this.novaCanvas.getContext2D()
  }

  clear(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.novaCanvas.width, this.novaCanvas.height)
  }

  schema(schema: NovaSchema): void {
    const items = Array.isArray(schema) ? schema : [schema]
    for (const item of items) {
      if (item.active === false) {
        continue
      }

      if (item.clip !== undefined && item.clip !== true) {
        this.clip(item.clip.x, item.clip.y, item.clip.width, item.clip.height)
      }

      switch (item.type) {
        case 'text':
          this.text(item)
          break
        case 'rect':
          this.rect(item)
          break
        case 'border':
          this.border(item)
          break
        case 'line':
          this.line(item)
          break
        case 'circle':
          this.circle(item)
          break
        case 'polygon':
          this.polygon(item)
          break
        case 'icon':
          this.icon(item)
          break
      }

      if (item.clip !== undefined && item.clip !== true) {
        this.clearClip()
      }
    }
  }

  redBox(): void {
    this.schema([
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        styles: {
          background: 'red',
        },
      },
    ])
  }

  save(): void {
    this.ctx.save()
  }

  restore(): void {
    this.ctx.restore()
  }

  clip(x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, width, height)
    ctx.clip()
  }

  clearClip(): void {
    this.ctx.restore()
  }

  setTransform(matrix: mat3): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(NovaGraphics.dpr(), NovaGraphics.dpr())
    this.ctx.transform(
      matrix[0],
      matrix[1],
      matrix[3],
      matrix[4],
      matrix[6],
      matrix[7],
    )
  }

  rect(p: NovaRect): void {
    const ctx = this.ctx
    ctx.save()

    if (p.styles?.opacity !== undefined) ctx.globalAlpha = p.styles.opacity

    // Фон
    if (p.styles?.background) {
      ctx.fillStyle =
        typeof p.styles.background === 'string'
          ? p.styles.background
          : ctx.createPattern(p.styles.background, 'repeat')!
      this._drawRoundedRect(
        p.x,
        p.y,
        p.width,
        p.height,
        p.styles.border?.radius || 0,
      )
      ctx.fill()
    }

    // Рамка
    if (p.styles?.border?.width) {
      ctx.strokeStyle = p.styles.border.color || '#000'
      ctx.lineWidth = p.styles.border.width

      if (p.styles.border.dashPattern) {
        ctx.setLineDash(p.styles.border.dashPattern)
      }

      this._drawRoundedRect(
        p.x,
        p.y,
        p.width,
        p.height,
        p.styles.border.radius || 0,
      )
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.globalAlpha = 1

    ctx.restore()
  }

  text(p: NovaText): void {
    if (p.clip === true) {
      const padding = this._resolvePadding(p.styles?.padding)
      const x = p.x + padding.left
      const y = p.y + padding.top
      const width = p.width - (padding.left + padding.right)
      const height = p.height - (padding.top + padding.bottom)

      if (width > 0) {
        this.clip(x, y, width, height)
      } else {
        this.clip(p.x, p.y, p.width, p.height)
      }
    }

    if (p.parser === 'markdown') {
      this.textMarkdown(p)
    } else {
      this.textString(p)
    }

    if (p.clip === true) {
      this.clearClip()
    }
  }

  private _resolvePadding(padding: any): {
    left: number
    right: number
    top: number
    bottom: number
  } {
    if (!padding) return { left: 0, right: 0, top: 0, bottom: 0 }
    if ('all' in padding)
      return {
        left: padding.all,
        right: padding.all,
        top: padding.all,
        bottom: padding.all,
      }
    if ('horizontal' in padding || 'vertical' in padding) {
      return {
        left: padding.horizontal || 0,
        right: padding.horizontal || 0,
        top: padding.vertical || 0,
        bottom: padding.vertical || 0,
      }
    }
    return {
      left: padding.left || 0,
      right: padding.right || 0,
      top: padding.top || 0,
      bottom: padding.bottom || 0,
    }
  }

  line(p: NovaLine): void {
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = p.styles?.color || '#000'
    ctx.lineWidth = p.styles?.width || 1
    ctx.setLineDash(p.styles?.dashPattern || [])
    ctx.globalAlpha = p.styles?.opacity ?? 1
    ctx.beginPath()
    ctx.moveTo(p.x1, p.y1)
    ctx.lineTo(p.x2, p.y2)
    ctx.stroke()
    ctx.restore()
  }

  circle(p: NovaCircle): void {
    const ctx = this.ctx
    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    if (p.styles?.background) {
      ctx.fillStyle = p.styles.background as string
      ctx.fill()
    }
    if (p.styles?.border?.width) {
      ctx.strokeStyle = p.styles.border.color || '#000'
      ctx.lineWidth = p.styles.border.width
      ctx.stroke()
    }
    ctx.restore()
  }

  polygon(p: NovaPolygon): void {
    const ctx = this.ctx
    ctx.save()

    if (p.styles?.opacity !== undefined) ctx.globalAlpha = p.styles.opacity

    ctx.beginPath()
    if (p.points.length > 0) {
      ctx.moveTo(p.points[0].x, p.points[0].y)
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y)
      }
      ctx.closePath()
    }

    if (p.styles?.background) {
      ctx.fillStyle = p.styles.background
      ctx.fill()
    }
    if (p.styles?.stroke) {
      ctx.strokeStyle = p.styles.stroke
      ctx.lineWidth = p.styles.lineWidth ?? 1
      ctx.stroke()
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }

  icon(p: NovaIcon): void {
    const ctx = this.ctx
    ctx.save()

    let iconObject = p.icon
    if (typeof p.icon === 'string') {
      iconObject = NovaGraphics.getAsset(p.icon)
    }
    if (!iconObject) {
      console.warn(`Icon not found: ${p.icon}`)
      return
    }

    ctx.drawImage(iconObject, p.x, p.y, p.width, p.height)
    ctx.restore()
  }

  cursor(value: string): void {
    this.novaCanvas.element.style.cursor = value
  }

  border(p: NovaBorder): void {
    const ctx = this.ctx
    ctx.save()

    const color = p.styles?.color || '#000'
    const w = p.styles?.width || 1

    ctx.fillStyle = color

    // Определим какие стороны рисовать
    const sides = new Set<string>()

    if (!p.position || p.position === 'all') {
      sides.add('top')
      sides.add('right')
      sides.add('bottom')
      sides.add('left')
    } else if (p.position === 'vertical') {
      sides.add('left')
      sides.add('right')
    } else if (p.position === 'horizontal') {
      sides.add('top')
      sides.add('bottom')
    } else if (Array.isArray(p.position)) {
      for (const s of p.position) {
        sides.add(s)
      }
    }

    if (sides.has('top')) {
      ctx.fillRect(p.x, p.y, p.width, w)
    }
    if (sides.has('right')) {
      ctx.fillRect(p.x + p.width - w, p.y, w, p.height)
    }
    if (sides.has('bottom')) {
      ctx.fillRect(p.x, p.y + p.height - w, p.width, w)
    }
    if (sides.has('left')) {
      ctx.fillRect(p.x, p.y, w, p.height)
    }

    ctx.restore()
  }

  private _drawRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const ctx = this.ctx
    const r = Math.min(radius, width / 2, height / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  private textString(p: NovaText): void {
    if (!p.text?.length) {
      return
    }

    const ctx = this.ctx
    ctx.save()

    if (_CANVAS2D_TEMP_MODE && p.meta?.textBg !== true) {
      ctx.clearRect(p.x, p.y, p.width, p.height)
    }

    // Настройка шрифта
    const fontSize = p.styles?.font?.size || 12
    const fontFamily = p.styles?.font?.family || 'Verdana'
    const fontWeight = p.styles?.font?.weight || 'normal'
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    ctx.fillStyle = p.styles?.color || '#000'
    ctx.globalAlpha = p.styles?.opacity ?? 1

    // Паддинги
    const padding = this._resolvePadding(p.styles?.padding)

    // Вычисляем базовые координаты
    let textX = p.x
    let textY = p.y

    // Горизонтальное выравнивание
    switch (p.styles?.align?.horizontal) {
      case 'left':
        textX += padding.left
        ctx.textAlign = 'left'
        break
      case 'right':
        textX += p.width - padding.right
        ctx.textAlign = 'right'
        break
      default: // center
        textX += p.width / 2
        ctx.textAlign = 'center'
        break
    }

    // Вертикальное выравнивание
    switch (p.styles?.align?.vertical) {
      case 'top':
        textY += padding.top
        ctx.textBaseline = 'top'
        break
      case 'bottom':
        textY += p.height - padding.bottom
        ctx.textBaseline = 'bottom'
        break
      default: // center
        textY += p.height / 2
        ctx.textBaseline = 'middle'
        break
    }

    // Эллипсис: вычисляем максимально доступную ширину текста
    let maxWidth = p.width
    if (
      p.styles?.align?.horizontal === 'left' ||
      p.styles?.align?.horizontal === 'right'
    ) {
      maxWidth -= padding.left + padding.right
    }

    let finalText = p.text
    if (p.styles?.ellipsis) {
      while (
        finalText.length > 0 &&
        ctx.measureText(finalText + '...').width > maxWidth
      ) {
        finalText = finalText.slice(0, -1)
      }
      if (finalText.length > 0 && finalText !== p.text) {
        finalText += '...'
      }
    }

    ctx.fillText(finalText, textX, textY)

    ctx.restore()
  }

  measureText(p: NovaText): { width: number; height: number } {
    const fontSize = p.styles?.font?.size || 12
    const fontFamily = p.styles?.font?.family || 'Verdana'
    const fontWeight = p.styles?.font?.weight || 'normal'
    const lineHeight = p.styles?.lineHeight || fontSize * 1.2

    const padding = this._resolvePadding(p.styles?.padding)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const chunks = this._parseMarkdownToChunks(p.text)
    let cursorX = 0
    let maxWidth = 0
    let totalLines = 1

    for (const chunk of chunks) {
      if (chunk.newline) {
        maxWidth = Math.max(maxWidth, cursorX)
        cursorX = 0
        totalLines += 1
        continue
      }

      const weight = chunk.bold ? 'bold' : chunk.italic ? 'italic' : fontWeight
      ctx.font = `${weight} ${fontSize}px ${fontFamily}`
      const width = ctx.measureText(chunk.text).width
      cursorX += width
    }

    maxWidth = Math.max(maxWidth, cursorX)

    return {
      width: Math.ceil(maxWidth + padding.left + padding.right),
      height: Math.ceil(totalLines * lineHeight),
    }
  }

  destroy(): void {}

  private textMarkdown(p: NovaText): void {
    const ctx = this.ctx
    ctx.save()

    const fontSize = p.styles?.font?.size || 12
    const fontFamily = p.styles?.font?.family || 'Verdana'
    const fontWeight = p.styles?.font?.weight || 'normal'
    const lineHeight = p.styles?.lineHeight || fontSize * 1.2

    const padding = this._resolvePadding(p.styles?.padding)
    let cursorX = p.x + padding.left
    let cursorY = p.y + padding.top

    const chunks = this._parseMarkdownToChunks(p.text)

    for (const chunk of chunks) {
      if (chunk.newline) {
        cursorX = p.x + padding.left
        cursorY += lineHeight
        continue
      }

      ctx.font = `${chunk.bold ? 'bold' : chunk.italic ? 'italic' : fontWeight} ${fontSize}px ${fontFamily}`
      ctx.fillStyle = p.styles?.color || '#000'
      ctx.textBaseline = 'top'

      ctx.fillText(chunk.text, cursorX, cursorY)
      cursorX += ctx.measureText(chunk.text).width
    }

    ctx.restore()
    return
  }

  private _parseMarkdownToChunks(input: string): NovaTextChunk[] {
    if (!input?.length) {
      return [{ text: '' }]
    }
    const lines = input.split('\n')
    const chunks: NovaTextChunk[] = []

    for (const line of lines) {
      const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
      for (const part of parts) {
        if (!part) continue

        if (/^\*\*(.+)\*\*$/.test(part)) {
          chunks.push({ text: part.slice(2, -2), bold: true })
        } else if (/^_(.+)_$/.test(part)) {
          chunks.push({ text: part.slice(1, -1), italic: true })
        } else {
          chunks.push({ text: part })
        }
      }
      chunks.push({ newline: true, text: '' })
    }

    return chunks
  }
}
