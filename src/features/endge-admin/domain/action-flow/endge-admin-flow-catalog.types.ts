import type { EndgeFlowNodeKind } from '@endge/core'

export interface EndgeAdminFlowPortSpec {
  id: string
  label: string
  direction: 'input' | 'output'
  multiple: boolean
  required: boolean
  valueType: string | null
}

export interface EndgeAdminFlowBlockSpec {
  id: string
  title: string
  description: string | null
  kind: EndgeFlowNodeKind
  configurable: boolean
  inputPorts: EndgeAdminFlowPortSpec[]
  outputPorts: EndgeAdminFlowPortSpec[]
  meta: Record<string, unknown>
}
