import { Endge } from '@endge/core'
import type { RComponentDSL } from '@endge/core'
import type { NovaSchema } from '@/features/nova/domain/types/renderer-types'
import type {
  CanvasBounds,
  CanvasComponentTypeProps,
  NovaJSXRenderer,
  NovaJSXRendererInput,
} from '@/features/nova-jsx/domain/types'
import { NovaJSXRegistry } from '@/features/nova-jsx/domain/entities/NovaJSXRegistry'

const DEFAULT_BOUNDS: CanvasBounds = {
  x: 0,
  y: 0,
  width: 1024,
  height: 768,
}

function resolveBounds(bounds?: Partial<CanvasBounds>): CanvasBounds {
  return {
    x: bounds?.x ?? DEFAULT_BOUNDS.x,
    y: bounds?.y ?? DEFAULT_BOUNDS.y,
    width: bounds?.width ?? DEFAULT_BOUNDS.width,
    height: bounds?.height ?? DEFAULT_BOUNDS.height,
  }
}

function getStaticAttr(node: any, name: string): string | undefined {
  const attr = node?.props?.find((p: any) => p?.type === 6 && p?.name === name)
  return attr?.value?.content
}

function hasStaticFlag(node: any, name: string): boolean {
  return !!node?.props?.find((p: any) => p?.type === 6 && p?.name === name)
}

function getBindExpr(node: any, name: string): string | undefined {
  const dir = node?.props?.find((p: any) =>
    p?.type === 7
    && p?.name === 'bind'
    && p?.arg?.type === 4
    && p?.arg?.content === name
    && p?.exp?.type === 4,
  )
  return dir?.exp?.content
}

function getDirectiveExpr(node: any, directiveName: string): string | undefined {
  const dir = node?.props?.find(
    (p: any) => p?.type === 7 && p?.name === directiveName && p?.exp?.type === 4,
  )
  return dir?.exp?.content
}

function readAttrAsAny(
  node: any,
  name: string,
  evaluateExpr: (expr: string) => any,
): any {
  const bindExpr = getBindExpr(node, name)
  if (bindExpr) {
    try {
      return evaluateExpr(bindExpr)
    } catch {
      return undefined
    }
  }
  const staticVal = getStaticAttr(node, name)
  if (staticVal !== undefined) {
    return staticVal
  }
  return undefined
}

function readNumberAttr(
  node: any,
  name: string,
  fallback: number,
  evaluateExpr: (expr: string) => any,
): number {
  const raw = readAttrAsAny(node, name, evaluateExpr)
  if (raw === undefined || raw === null || raw === '')
    return fallback
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function readStringAttr(
  node: any,
  name: string,
  fallback: string,
  evaluateExpr: (expr: string) => any,
): string {
  const raw = readAttrAsAny(node, name, evaluateExpr)
  if (raw === undefined || raw === null)
    return fallback
  return String(raw)
}

function readTextChildren(
  node: any,
  evaluateExpr: (expr: string) => any,
): string {
  const children = Array.isArray(node?.children) ? node.children : []
  const chunks: string[] = []
  for (const child of children) {
    if (child?.type === 2 && typeof child.content === 'string') {
      chunks.push(child.content)
      continue
    }
    if (child?.type === 5 && child?.content?.type === 4) {
      try {
        const v = evaluateExpr(child.content.content)
        chunks.push(v == null ? '' : String(v))
      } catch {
        chunks.push('')
      }
    }
  }
  return chunks.join('').trim()
}

function renderChildrenInSameBounds(input: NovaJSXRendererInput): NovaSchema {
  const out: NovaSchema = []
  const children = Array.isArray(input.node?.children) ? input.node.children : []
  for (const child of children) {
    out.push(...input.renderNode(child, input.bounds))
  }
  return out
}

function renderBox(input: NovaJSXRendererInput): NovaSchema {
  const x = readNumberAttr(input.node, 'x', input.bounds.x, input.evaluateExpr)
  const y = readNumberAttr(input.node, 'y', input.bounds.y, input.evaluateExpr)
  const width = readNumberAttr(
    input.node,
    'width',
    input.bounds.width,
    input.evaluateExpr,
  )
  const height = readNumberAttr(
    input.node,
    'height',
    input.bounds.height,
    input.evaluateExpr,
  )

  const bg = readAttrAsAny(input.node, 'bg', input.evaluateExpr)
  const borderColor = readStringAttr(
    input.node,
    'borderColor',
    '#d1d5db',
    input.evaluateExpr,
  )
  const borderWidth = readNumberAttr(input.node, 'borderWidth', 0, input.evaluateExpr)
  const radius = readNumberAttr(input.node, 'radius', 0, input.evaluateExpr)
  const padding = readNumberAttr(input.node, 'p', 0, input.evaluateExpr)

  const schema: NovaSchema = []
  if (bg !== undefined || borderWidth > 0) {
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      styles: {
        background: bg !== undefined ? String(bg) : undefined,
        border:
          borderWidth > 0
            ? { color: borderColor, width: borderWidth, radius }
            : undefined,
      },
    })
  }

  const childBounds: CanvasBounds = {
    x: x + padding,
    y: y + padding,
    width: Math.max(0, width - padding * 2),
    height: Math.max(0, height - padding * 2),
  }
  for (const child of input.node?.children || []) {
    schema.push(...input.renderNode(child, childBounds))
  }

  return schema
}

function renderLayout(
  input: NovaJSXRendererInput,
  forcedDirection?: 'row' | 'column',
): NovaSchema {
  const x = readNumberAttr(input.node, 'x', input.bounds.x, input.evaluateExpr)
  const y = readNumberAttr(input.node, 'y', input.bounds.y, input.evaluateExpr)
  const width = readNumberAttr(
    input.node,
    'width',
    input.bounds.width,
    input.evaluateExpr,
  )
  const height = readNumberAttr(
    input.node,
    'height',
    input.bounds.height,
    input.evaluateExpr,
  )

  const direction =
    forcedDirection
    || (readStringAttr(input.node, 'direction', 'row', input.evaluateExpr) === 'column'
      ? 'column'
      : 'row')
  const gap = readNumberAttr(input.node, 'gap', 8, input.evaluateExpr)
  const padding = readNumberAttr(input.node, 'p', 0, input.evaluateExpr)

  const bg = readAttrAsAny(input.node, 'bg', input.evaluateExpr)
  const schema: NovaSchema = []

  if (bg !== undefined) {
    schema.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      styles: { background: String(bg) },
    })
  }

  const innerX = x + padding
  const innerY = y + padding
  const innerWidth = Math.max(0, width - padding * 2)
  const innerHeight = Math.max(0, height - padding * 2)

  const childElements = (input.node?.children || []).filter(
    (child: any) => child?.type === 1 || child?.type === 2 || child?.type === 5,
  )

  if (childElements.length === 0)
    return schema

  if (direction === 'row') {
    let cursorX = innerX
    const defaultW = Math.max(
      0,
      (innerWidth - gap * Math.max(0, childElements.length - 1))
        / childElements.length,
    )
    for (const child of childElements) {
      const childW = readNumberAttr(child, 'width', defaultW, input.evaluateExpr)
      const childH = readNumberAttr(child, 'height', innerHeight, input.evaluateExpr)
      const childBounds: CanvasBounds = {
        x: cursorX,
        y: innerY,
        width: Math.max(0, childW),
        height: Math.max(0, childH),
      }
      schema.push(...input.renderNode(child, childBounds))
      cursorX += childBounds.width + gap
    }
    return schema
  }

  let cursorY = innerY
  const defaultH = Math.max(
    0,
    (innerHeight - gap * Math.max(0, childElements.length - 1))
      / childElements.length,
  )
  for (const child of childElements) {
    const childW = readNumberAttr(child, 'width', innerWidth, input.evaluateExpr)
    const childH = readNumberAttr(child, 'height', defaultH, input.evaluateExpr)
    const childBounds: CanvasBounds = {
      x: innerX,
      y: cursorY,
      width: Math.max(0, childW),
      height: Math.max(0, childH),
    }
    schema.push(...input.renderNode(child, childBounds))
    cursorY += childBounds.height + gap
  }

  return schema
}

function renderText(input: NovaJSXRendererInput): NovaSchema {
  const text =
    readAttrAsAny(input.node, 'value', input.evaluateExpr) ?? readTextChildren(input.node, input.evaluateExpr)
  const fontSize = readNumberAttr(input.node, 'size', 14, input.evaluateExpr)
  const lineHeight = readNumberAttr(
    input.node,
    'lineHeight',
    Math.round(fontSize * 1.3),
    input.evaluateExpr,
  )
  const color = readStringAttr(input.node, 'color', '#111827', input.evaluateExpr)
  const weight = readStringAttr(input.node, 'weight', 'normal', input.evaluateExpr)
  const align = readStringAttr(input.node, 'align', 'left', input.evaluateExpr)
  const valign = readStringAttr(input.node, 'valign', 'top', input.evaluateExpr)

  const x = readNumberAttr(input.node, 'x', input.bounds.x, input.evaluateExpr)
  const y = readNumberAttr(input.node, 'y', input.bounds.y, input.evaluateExpr)
  const width = readNumberAttr(
    input.node,
    'width',
    input.bounds.width,
    input.evaluateExpr,
  )
  const height = readNumberAttr(
    input.node,
    'height',
    Math.max(lineHeight, input.bounds.height),
    input.evaluateExpr,
  )

  return [
    {
      type: 'text',
      text: String(text ?? ''),
      x,
      y,
      width,
      height,
      styles: {
        color,
        lineHeight,
        font: {
          family: 'Inter',
          size: fontSize,
          weight: weight as any,
        },
        align: {
          horizontal: align as any,
          vertical: valign === 'center' ? 'middle' : (valign as any),
        },
      },
    },
  ]
}

function createComponentRenderer(registry: NovaJSXRegistry): NovaJSXRenderer {
  return (input: NovaJSXRendererInput): NovaSchema => {
    const id = readStringAttr(input.node, 'id', '', input.evaluateExpr)
    if (!id) {
      console.warn('[NOVA][JSX Component]: id attribute is missing')
      return []
    }

    const target = Endge.domain.getComponent(id) as any
    if (!target) {
      console.warn(`[NOVA][JSX Component]: component "${id}" not found`)
      return []
    }
    if (target.kind !== 'jsx') {
      console.warn(`[NOVA][JSX Component]: component "${id}" is not JSX`)
      return []
    }

    const localComData: Record<string, any> = {}
    for (const prop of input.node?.props || []) {
      if (prop?.type === 6) {
        if (prop.name === 'id')
          continue
        localComData[prop.name] = prop.value?.content || true
      }
      if (
        prop?.type === 7
        && prop?.name === 'bind'
        && prop?.arg?.type === 4
        && prop?.exp?.type === 4
      ) {
        localComData[prop.arg.content] = input.evaluateExpr(prop.exp.content.trim())
      }
    }

    return input.renderDSLModel({
      model: target,
      scope: input.scope,
      comData: localComData,
      bounds: input.bounds,
    })
  }
}

export function createDefaultNovaJSXRegistry(): NovaJSXRegistry {
  const registry = new NovaJSXRegistry()
  registry.register('Text', renderText)
  registry.register('Box', renderBox)
  registry.register('Layout', (input) => renderLayout(input))
  registry.register('Flex', (input) => {
    const forceDirection = hasStaticFlag(input.node, 'col') ? 'column' : 'row'
    return renderLayout(input, forceDirection)
  })
  registry.register('Component', createComponentRenderer(registry))
  return registry
}

function createDefaultEvaluateExpr(
  model: RComponentDSL,
  comData: Record<string, any>,
): (expr: string) => any {
  const varsMap = new Map<string, any>()
  model.varsPaths.forEach((path, key) => {
    const value = Endge.extract.path(comData, Endge.domain, path, null)
    varsMap.set(key, value)
  })

  return (expr: string): any => {
    const key = expr.trim()
    if (varsMap.has(key)) {
      return varsMap.get(key)
    }
    return Object.prototype.hasOwnProperty.call(comData, key)
      ? comData[key]
      : undefined
  }
}

function isElementNode(node: any): boolean {
  return node?.type === 1
}

function isTextNode(node: any): boolean {
  return node?.type === 2
}

function isInterpolationNode(node: any): boolean {
  return node?.type === 5
}

export function ComponentType_DSL_Canvas(
  props: CanvasComponentTypeProps<RComponentDSL>,
  registry: NovaJSXRegistry = createDefaultNovaJSXRegistry(),
): NovaSchema {
  const model = props.model
  const ast = model.ast
  if (!ast) {
    return []
  }

  const rootBounds = resolveBounds(props.bounds)
  const allData = {
    ...props.comData,
    ...(props.context ?? {}),
  }
  const evaluateExpr = createDefaultEvaluateExpr(
    model,
    props.comData,
  )

  const renderDSLModel = (
    childProps: CanvasComponentTypeProps<RComponentDSL>,
  ): NovaSchema => ComponentType_DSL_Canvas(childProps, registry)

  const renderNode = (node: any, bounds: CanvasBounds): NovaSchema => {
    if (isElementNode(node)) {
      const ifExpr = getDirectiveExpr(node, 'if')
      if (ifExpr) {
        const shouldRender = Boolean(evaluateExpr(ifExpr))
        if (!shouldRender) {
          return []
        }
      }

      const renderer = registry.get(node.tag)
      if (!renderer) {
        return (node.children || []).flatMap((child: any) => renderNode(child, bounds))
      }
      return renderer({
        node,
        bounds,
        scope: props.scope,
        comData: props.comData,
        allData,
        evaluateExpr,
        renderNode,
        renderDSLModel,
      })
    }

    if (isTextNode(node)) {
      const text = String(node.content ?? '').trim()
      if (!text.length)
        return []
      return [
        {
          type: 'text',
          text,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: 20,
          styles: {
            color: '#111827',
            font: { family: 'Inter', size: 14, weight: 'normal' },
            align: { horizontal: 'left', vertical: 'top' },
          },
        },
      ]
    }

    if (isInterpolationNode(node)) {
      const expr = node?.content?.content
      const value = expr ? evaluateExpr(expr) : ''
      return [
        {
          type: 'text',
          text: value == null ? '' : String(value),
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: 20,
          styles: {
            color: '#111827',
            font: { family: 'Inter', size: 14, weight: 'normal' },
            align: { horizontal: 'left', vertical: 'top' },
          },
        },
      ]
    }

    return []
  }

  const schema: NovaSchema = []
  const astChildren = Array.isArray(ast.children) ? ast.children : []
  for (const node of astChildren) {
    schema.push(...renderNode(node, rootBounds))
  }

  return schema
}

export function renderDSLToCanvasSchema(
  props: CanvasComponentTypeProps<RComponentDSL>,
  registry?: NovaJSXRegistry,
): NovaSchema {
  return ComponentType_DSL_Canvas(props, registry)
}

export function renderNodeWithFallback(input: NovaJSXRendererInput): NovaSchema {
  return renderChildrenInSameBounds(input)
}
