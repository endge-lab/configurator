import type { DiagnosticsRecord } from '@endge/core'
import type {
  DiagnosticsLogTreeNode,
  DiagnosticsSpanTreeNode,
  DiagnosticsTreeNode,
} from '@/features/endge-ide/domain/types/diagnostics-presentation.type'

/** Строит UI-дерево из независимых core log/span records. */
export function buildDiagnosticsTree(records: readonly DiagnosticsRecord[]): DiagnosticsTreeNode[] {
  const roots: DiagnosticsTreeNode[] = []
  const spans = new Map<string, DiagnosticsSpanTreeNode>()

  for (const record of records) {
    if (record.signal !== 'span')
      continue
    spans.set(record.spanId, {
      id: `span:${record.spanId}`,
      kind: 'span',
      timestamp: record.startTimestamp,
      scope: record.scope.name,
      traceId: record.traceId,
      spanId: record.spanId,
      name: record.name,
      durationMs: record.durationMs,
      status: record.status,
      record,
      children: [],
    })
  }

  for (const node of spans.values()) {
    const parent = node.record.parentSpanId ? spans.get(node.record.parentSpanId) : undefined
    if (parent)
      parent.children.push(node)
    else
      roots.push(node)
  }

  for (const record of records) {
    if (record.signal !== 'log')
      continue
    const node: DiagnosticsLogTreeNode = {
      id: `log:${record.id}`,
      kind: 'log',
      timestamp: record.timestamp,
      severityNumber: record.severityNumber,
      scope: record.scope.name,
      traceId: record.traceId,
      spanId: record.spanId,
      body: record.body,
      record,
    }
    const parent = record.spanId ? spans.get(record.spanId) : undefined
    if (parent)
      parent.children.push(node)
    else
      roots.push(node)
  }

  sortDiagnosticsTree(roots)
  return roots
}

/** Находит span subtree по id без переноса presentation helper в core. */
export function findDiagnosticsSpanNode(
  nodes: readonly DiagnosticsTreeNode[],
  spanId: string,
): DiagnosticsSpanTreeNode | null {
  for (const node of nodes) {
    if (node.kind !== 'span')
      continue
    if (node.spanId === spanId)
      return node
    const nested = findDiagnosticsSpanNode(node.children, spanId)
    if (nested)
      return nested
  }
  return null
}

/** Стабильно сортирует каждый уровень дерева по времени записи. */
function sortDiagnosticsTree(nodes: DiagnosticsTreeNode[]): void {
  nodes.sort((left, right) => left.timestamp - right.timestamp)
  for (const node of nodes) {
    if (node.kind === 'span')
      sortDiagnosticsTree(node.children)
  }
}
