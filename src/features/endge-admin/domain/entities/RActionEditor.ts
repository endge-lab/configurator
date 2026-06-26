import type { ActionDefinition, EndgeFlowDefinition, RAction } from '@endge/core'

import { RField } from '@endge/core'

import { EndgeFlowEditorModel } from '@/features/endge-admin/domain/action-flow/EndgeFlowEditorModel'

function cloneActionField(value: unknown, fallbackName: string): RField | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null

  const raw = value as Record<string, unknown>
  const type = String(raw.type ?? '').trim()
  if (!type)
    return null

  const name = String(raw.name ?? '').trim() || fallbackName
  return new RField(
    name,
    type,
    raw.isArray === true,
    raw.optional === true,
  )
}

function normalizeFlowDefinition(rawDefinition: unknown): EndgeFlowDefinition {
  if (!rawDefinition || typeof rawDefinition !== 'object' || Array.isArray(rawDefinition)) {
    return {
      version: 1,
      entrypoint: 'flow-entry',
      nodes: [],
      edges: [],
    }
  }

  const flow = rawDefinition as Record<string, unknown>
  return {
    version: Number(flow.version ?? 1) || 1,
    entrypoint: String(flow.entrypoint ?? 'flow-entry').trim() || 'flow-entry',
    nodes: Array.isArray(flow.nodes) ? flow.nodes as EndgeFlowDefinition['nodes'] : [],
    edges: Array.isArray(flow.edges) ? flow.edges as EndgeFlowDefinition['edges'] : [],
  }
}

export class RActionEditor {
  id!: number
  identity!: string
  displayName!: string
  description: string | null = null
  input: RField | null = null
  output: RField | null = null
  active: boolean = true
  definition: ActionDefinition = {
    version: 1,
    entrypoint: 'flow-entry',
    nodes: [],
    edges: [],
  }

  flowEditor: EndgeFlowEditorModel = new EndgeFlowEditorModel()

  fillFromSource(source: RAction): void {
    this.id = source.id
    this.identity = String(source.identity ?? '').trim()
    this.displayName = String(source.displayName ?? source.name ?? '').trim()
    this.description = source.description ?? null
    this.input = cloneActionField(source.input, 'input')
    this.output = cloneActionField(source.output, 'output')
    this.active = source.active !== false
    this.definition = normalizeFlowDefinition(source.definition)
    this.rebuildFlowEditorFromDefinition()
  }

  updateSource(source: RAction): void {
    this.syncDefinitionFromFlowEditor()
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description ?? null
    source.input = cloneActionField(this.input, 'input')
    source.output = cloneActionField(this.output, 'output')
    source.active = this.active
    source.definition = normalizeFlowDefinition(this.definition)
  }

  rebuildFlowEditorFromDefinition(): void {
    this.flowEditor.fillFromDefinition(normalizeFlowDefinition(this.definition))
  }

  syncDefinitionFromFlowEditor(): void {
    this.definition = this.flowEditor.toDefinition()
  }
}
