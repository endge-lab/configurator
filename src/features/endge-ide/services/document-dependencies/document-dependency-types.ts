import type { DomainDocumentType } from '@endge/core'

export type DocumentDependencyNodeKind
  = | 'document'
    | 'composition'
    | 'group'
    | 'scope'
    | 'runtime'
    | 'data'
    | 'resource'

export type DocumentDependencyNodeStatus
  = | 'valid'
    | 'missing'
    | 'compile-error'
    | 'cycle'

export interface DocumentDependencyNode {
  id: string
  kind: DocumentDependencyNodeKind
  identity: string
  alias: string | null
  title: string
  documentType: DomainDocumentType | null
  icon: string
  colorClass: string
  badgeIcon: string | null
  activationMode: 'startup' | 'manual' | null
  status: DocumentDependencyNodeStatus
  diagnosticCount: number
  relationRole?: string | null
  children: DocumentDependencyNode[]
}

export interface DocumentDependencyDiagnostic {
  severity?: string
}

export interface DocumentDependencyTreeResult {
  status: 'valid' | 'compile-error'
  root: DocumentDependencyNode | null
  diagnostics: DocumentDependencyDiagnostic[]
}

export interface DocumentDependencyTreeInput {
  documentType: DomainDocumentType
  id?: string | number | null
  identity: string
  displayName?: string | null
  source?: string | null
  draft?: unknown
}

export function countDocumentDependencies(
  root: DocumentDependencyNode | null,
): number {
  if (!root) {
    return 0
  }
  return root.children.reduce(
    (total, child) =>
      total
      + (child.kind === 'group' ? 0 : 1)
      + countDocumentDependencies(child),
    0,
  )
}
