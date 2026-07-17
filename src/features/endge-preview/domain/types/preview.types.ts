import type {
  ComponentSFCRuntimeHost,
  CompositionRuntimeHost,
  FilterViewRuntimeHost,
  RuntimeHost,
  RuntimeHostInputSource,
  StoreRuntimeHost,
} from '@endge/core'

export type EndgePreviewEntityType = 'project' | 'composition' | 'component-sfc' | 'store'
export type PreviewTreeNodeKind = 'project' | 'composition' | 'scope' | 'runtime' | 'resource' | 'component-sfc'
export type PreviewLifecycleState = 'inactive' | 'activating' | 'active' | 'pausing' | 'paused' | 'error' | 'disposed'

export interface EndgePreviewTarget {
  entityType: EndgePreviewEntityType
  identity: string
}

/** Runtime path from a root project/composition entry to a nested Composition host. */
export interface PreviewCompositionAddress {
  rootIdentity: string
  invocationPath: string[]
}

export interface PreviewRuntimeTreeNode {
  id: string
  parentId: string | null
  kind: PreviewTreeNodeKind
  title: string
  subtitle: string | null
  entityType: string
  identity: string
  activationMode: 'startup' | 'manual' | null
  composition: PreviewCompositionAddress | null
  runtimePath: string | null
  scopePath: string | null
  resourcePath: string | null
  renderable: boolean
  children: PreviewRuntimeTreeNode[]
}

export type PreviewRenderable
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

export interface ResolvedPreviewComposition {
  host: CompositionRuntimeHost
  rootIdentity: string
}
