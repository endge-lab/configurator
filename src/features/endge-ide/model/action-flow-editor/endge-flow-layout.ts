import type { EndgeFlowDefinition } from '@endge/core'

export interface EndgeFlowLayoutNodePosition {
  id: string
  x: number
  y: number
}

export function buildEndgeFlowLinearLayout(
  definition: EndgeFlowDefinition,
  opts: { startX?: number, startY?: number, gapX?: number, gapY?: number } = {},
): EndgeFlowLayoutNodePosition[] {
  const startX = opts.startX ?? 280
  const startY = opts.startY ?? 180
  const gapX = opts.gapX ?? 380
  const gapY = opts.gapY ?? 180

  return definition.nodes.map((node, index) => ({
    id: node.id,
    x: startX + index * gapX,
    y: startY + (index % 2) * gapY,
  }))
}
