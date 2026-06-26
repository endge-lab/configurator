import type { NovaRect } from '@/features/nova/domain/types/renderer-types'

export type NovaWebGLBatchType = 'fill' | 'border'

export class NovaWebGLBatch {
  rects: NovaRect[] = []
  color: string

  constructor(color: string) {
    this.color = color
  }

  add(rect: NovaRect): void {
    this.rects.push(rect)
  }

  clear(): void {
    this.rects = []
  }
}
