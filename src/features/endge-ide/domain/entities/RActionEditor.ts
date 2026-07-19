import type { ActionDefinition, ActionImplementation, ActionTargetSelector, EndgeFlowDefinition, ImplementationBindingScope, RAction } from '@endge/core'

import { Endge, RField } from '@endge/core'

import { EndgeFlowEditorModel } from '@/features/endge-ide/domain/action-flow/EndgeFlowEditorModel'

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
  target: ActionTargetSelector[] | null = null
  defaultImplementation: ActionImplementation = { kind: 'flow' }
  overridden = false
  effectiveProviderKey: string | null = null
  effectiveProviderOrigin: string | null = null
  bindingScope: ImplementationBindingScope | null = null
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
    this.target = source.target?.map(selector => ({ ...selector })) ?? null
    this.defaultImplementation = { ...source.defaultImplementation }
    const resolved = Endge.actions.listResolved().find(action => action.identity === source.identity)
    this.overridden = resolved?.overridden === true
    this.effectiveProviderKey = resolved?.effectiveProviderKey ?? null
    this.effectiveProviderOrigin = resolved?.effectiveProviderOrigin?.kind ?? null
    this.bindingScope = resolved?.bindingScope ?? null
    this.definition = normalizeFlowDefinition(source.definition)
    this.rebuildFlowEditorFromDefinition()
  }

  updateSource(source: RAction): void {
    if (!this.overridden)
      this.syncDefinitionFromFlowEditor()
    source.id = this.id
    source.identity = this.identity
    source.name = this.displayName
    source.displayName = this.displayName
    source.description = this.description ?? null
    if (!this.overridden) {
      source.input = cloneActionField(this.input, 'input')
      source.output = cloneActionField(this.output, 'output')
      source.target = this.target?.map(selector => ({ ...selector })) ?? null
      source.definition = normalizeFlowDefinition(this.definition)
    }
    source.active = this.active
  }

  rebuildFlowEditorFromDefinition(): void {
    this.flowEditor.fillFromDefinition(normalizeFlowDefinition(this.definition))
  }

  syncDefinitionFromFlowEditor(): void {
    this.definition = this.flowEditor.toDefinition()
  }
}
