import type { EndgeFlowNodeKind } from '@endge/core'

export interface EndgeIDEFlowPortSpec {
  id: string
  label: string
  direction: 'input' | 'output'
  multiple: boolean
  required: boolean
  valueType: string | null
}

export interface EndgeIDEFlowBlockSpec {
  id: string
  title: string
  description: string | null
  kind: EndgeFlowNodeKind
  configurable: boolean
  inputPorts: EndgeIDEFlowPortSpec[]
  outputPorts: EndgeIDEFlowPortSpec[]
  meta: Record<string, unknown>
}
