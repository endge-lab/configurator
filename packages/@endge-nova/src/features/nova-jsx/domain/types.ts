import type { RComponentDSL, RuntimeScope } from '@endge/core'
import type { NovaSchema } from '@/features/nova/domain/types/renderer-types'

export interface CanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasComponentTypeProps<T extends RComponentDSL> {
  model: T
  comData: Record<string, any>
  scope: RuntimeScope
  context?: Record<string, any>
  bounds?: Partial<CanvasBounds>
}

export interface NovaJSXRendererInput {
  node: any
  bounds: CanvasBounds
  scope: RuntimeScope
  comData: Record<string, any>
  allData: Record<string, any>
  evaluateExpr: (expr: string) => any
  renderNode: (node: any, bounds: CanvasBounds) => NovaSchema
  renderDSLModel: (props: CanvasComponentTypeProps<RComponentDSL>) => NovaSchema
}

export type NovaJSXRenderer = (input: NovaJSXRendererInput) => NovaSchema
