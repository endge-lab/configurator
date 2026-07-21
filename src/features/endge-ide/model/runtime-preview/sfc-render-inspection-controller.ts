/* eslint-disable style/max-statements-per-line */
import type { SFCRenderInspectionNode, SFCRenderInspectionTreeNode } from '@endge/core'

import { SFCRenderInspectionSession } from '@endge/core'
import { computed, ref } from 'vue'

/** Configurator-owned selection and JSON projection over the renderer-neutral session. */
export class SFCRenderInspectionController {
  public readonly session = new SFCRenderInspectionSession()
  public readonly hoveredId = ref<string | null>(null)
  public readonly pinnedId = ref<string | null>(null)
  private readonly _revision = ref(0)
  private readonly _unsubscribe: VoidFunction

  public readonly activeId = computed(() => this.pinnedId.value ?? this.hoveredId.value)
  public readonly roots = computed<SFCRenderInspectionTreeNode[]>(() => {
    void this._revision.value
    return this.session.getTree()
  })

  public readonly activeNode = computed<SFCRenderInspectionNode | null>(() => {
    void this._revision.value
    const id = this.activeId.value
    return id ? this.session.getNode(id) : null
  })

  public readonly activeData = computed<Record<string, unknown> | null>(() => {
    const node = this.activeNode.value
    if (!node) { return null }
    return toInspectableValue({
      component: node.calledComponentIdentity ?? node.componentIdentity,
      node: {
        id: node.nodeId,
        tag: node.tag,
        componentTag: node.componentTag,
        kind: node.kind,
        scope: node.scope,
        componentPath: node.componentStack,
        sourceRange: node.sourceRange,
        meta: node.meta,
      },
      props: node.props,
      componentProps: node.componentProps,
      locals: node.locals,
      bindings: node.bindings,
    }) as Record<string, unknown>
  })

  public constructor() {
    this._unsubscribe = this.session.subscribe(() => {
      this._revision.value += 1
      if (this.pinnedId.value && !this.session.getNode(this.pinnedId.value)) { this.pinnedId.value = null }
      if (this.hoveredId.value && !this.session.getNode(this.hoveredId.value)) { this.hoveredId.value = null }
    })
  }

  public hover(id: string | null): void {
    if (this.pinnedId.value) { return }
    this.hoveredId.value = id && this.session.getNode(id) ? id : null
  }

  public clearHover(): void {
    if (!this.pinnedId.value) { this.hoveredId.value = null }
  }

  public pin(id: string | null): void {
    this.pinnedId.value = id && this.session.getNode(id) ? id : null
    if (this.pinnedId.value) { this.hoveredId.value = null }
  }

  public unpin(): void {
    this.pinnedId.value = null
    this.hoveredId.value = null
  }

  public reset(): void {
    this.unpin()
    this.session.clear()
  }

  public destroy(): void {
    this._unsubscribe()
    this.reset()
  }
}

function toInspectableValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') { return value }
  if (typeof value === 'bigint') { return `${value}n` }
  if (typeof value === 'function') { return `[Function ${value.name || 'anonymous'}]` }
  if (typeof value === 'symbol') { return String(value) }
  if (depth >= 8) { return '[Max depth]' }
  if (value instanceof Date) { return value.toISOString() }
  if (value instanceof Error) { return { name: value.name, message: value.message } }
  if (typeof value !== 'object') { return String(value) }
  if (seen.has(value)) { return '[Circular]' }
  seen.add(value)
  if (Array.isArray(value)) {
    const items = value.slice(0, 100).map(item => toInspectableValue(item, seen, depth + 1))
    if (value.length > 100) { items.push(`[+${value.length - 100} more]`) }
    return items
  }
  let sourceEntries: [string, unknown][]
  try {
    sourceEntries = Object.entries(value as Record<string, unknown>)
  }
  catch (error) {
    return `[Uninspectable: ${error instanceof Error ? error.message : String(error)}]`
  }
  const entries = sourceEntries.slice(0, 100)
  const result = Object.fromEntries(entries.map(([key, item]) => [key, toInspectableValue(item, seen, depth + 1)]))
  const total = sourceEntries.length
  if (total > entries.length) { result.$truncated = `${total - entries.length} more fields` }
  return result
}
