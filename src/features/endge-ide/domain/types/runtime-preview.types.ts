import type {
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  DomainDocumentType,
  FilterViewRuntimeHost,
  RuntimeHost,
  RuntimeHostInputSource,
  StoreRuntimeHost,
} from '@endge/core'

export const ENDGE_IDE_RUNTIME_TREE_WIDGET_ID = 'runtime-tree'
export const LEGACY_ENDGE_PREVIEW_WIDGET_ID = 'preview-runtime-tree'

export type RuntimePreviewEntityType = 'project' | 'composition' | 'component-sfc' | 'store'
export type RuntimePreviewTreeNodeKind = 'project' | 'composition' | 'scope' | 'runtime' | 'resource' | 'component-sfc'
export type RuntimePreviewLifecycleState
  = | 'inactive'
    | 'preparing'
    | 'activating'
    | 'active'
    | 'pausing'
    | 'paused'
    | 'stopped'
    | 'error'
    | 'disposed'

export interface RuntimePreviewTarget {
  entityType: RuntimePreviewEntityType
  identity: string
}

export interface RuntimePreviewCompositionAddress {
  rootIdentity: string
  invocationPath: string[]
}

export interface RuntimePreviewTreeNodePresentation {
  documentType: DomainDocumentType | null
  icon: string
  colorClass: string
  badgeIcon: string | null
  runtimeName: string | null
}

export interface RuntimePreviewTreeNode {
  id: string
  parentId: string | null
  kind: RuntimePreviewTreeNodeKind
  title: string
  subtitle: string | null
  entityType: string
  identity: string
  presentation: RuntimePreviewTreeNodePresentation | null
  activationMode: 'startup' | 'manual' | null
  composition: RuntimePreviewCompositionAddress | null
  runtimePath: string | null
  scopePath: string | null
  resourcePath: string | null
  renderable: boolean
  children: RuntimePreviewTreeNode[]
}

export type RuntimePreviewRenderable
  = {
    kind: 'filter-view'
    key: string
    title: string
    runtime: FilterViewRuntimeHost
  }
  | {
    kind: 'component-sfc'
    key: string
    title: string
    runtime: ComponentSFCRuntimeHost
    input: RuntimeHostInputSource
  }
  | {
    kind: 'store'
    key: string
    title: string
    runtime: StoreRuntimeHost
  }
  | {
    kind: 'runtime'
    key: string
    title: string
    runtime: RuntimeHost<any, any>
  }

export interface ResolvedRuntimePreviewComposition {
  host: CompositionRuntimeHost
  rootIdentity: string
}

export function runtimePreviewKey(target: RuntimePreviewTarget): string {
  return `${target.entityType}:${target.identity}`
}
