import type {
  DiagnosticsLogRecord,
  DiagnosticsSeverityNumber,
  DiagnosticsSpanRecord,
} from '@endge/core'

/** Общие поля узла дерева diagnostics в configurator UI. */
export interface DiagnosticsTreeNodeBase {
  id: string
  kind: 'span' | 'log'
  timestamp: number
  severityNumber?: DiagnosticsSeverityNumber
  scope: string
  traceId?: string
  spanId?: string
}

/** UI-проекция завершённого span и его дочерних records. */
export interface DiagnosticsSpanTreeNode extends DiagnosticsTreeNodeBase {
  kind: 'span'
  name: string
  durationMs: number
  status: DiagnosticsSpanRecord['status']
  record: DiagnosticsSpanRecord
  children: DiagnosticsTreeNode[]
}

/** UI-проекция одного structured log. */
export interface DiagnosticsLogTreeNode extends DiagnosticsTreeNodeBase {
  kind: 'log'
  body: string
  record: DiagnosticsLogRecord
}

/** Узел presentation tree, который не является core diagnostics contract. */
export type DiagnosticsTreeNode = DiagnosticsSpanTreeNode | DiagnosticsLogTreeNode
