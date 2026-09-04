import type {
  AuthProfileSchema,
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  DomainDocumentType,
  FilterViewRuntimeHost,
  RuntimeHost,
  RuntimeHostInputSource,
  StoreRuntimeHost,
} from '@endge/core'

export interface RuntimePreviewAuthPrompt {
  profiles: AuthProfileSchema[]
  currentIndex: number
  pending: boolean
  error: string | null
}

export const ENDGE_IDE_RUNTIME_TREE_WIDGET_ID = 'runtime-tree'
export const LEGACY_ENDGE_PREVIEW_WIDGET_ID = 'preview-runtime-tree'

export type RuntimePreviewEntityType = 'project' | 'composition' | 'component-sfc' | 'store'
export type RuntimePreviewTreeNodeKind = 'project' | 'composition' | 'scope' | 'group' | 'runtime' | 'data' | 'resource' | 'component-sfc'
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

export type RuntimePreviewOccurrenceKind = 'composition' | 'component-runtime'

/** Статический адрес одного использования цели внутри программы текущего Project. */
export interface RuntimePreviewOccurrence {
  id: string
  kind: RuntimePreviewOccurrenceKind
  projectIdentity: string
  nodeId: string
  composition: RuntimePreviewCompositionAddress
  runtimePath: string | null
  path: string[]
  /** Вложенный SFC, который нужно закрепить в инспекторе семантического renderer после выбора его host. */
  renderComponentIdentity: string | null
  /** Консервативный флаг: активация этой ветви может выполнить Query монтирования Composition. */
  mayExecuteQueries: boolean
}

export interface RuntimePreviewContextualLaunch {
  target: RuntimePreviewTarget
  occurrence: RuntimePreviewOccurrence
}

/** Текущее состояние редактора для запуска Runtime Preview без сохранения. */
export interface RuntimePreviewDraft {
  id?: string | number | null
  identity?: string | null
  tag?: string | null
  name?: string | null
  displayName?: string | null
  source: string
  sourceVersion?: number | null
}

export interface RuntimePreviewLaunchRequest extends RuntimePreviewTarget {
  draft?: RuntimePreviewDraft
  contextual?: RuntimePreviewContextualLaunch
}

export interface RuntimePreviewOccurrencePrompt {
  target: RuntimePreviewTarget
  occurrences: RuntimePreviewOccurrence[]
  liveMode: boolean
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
