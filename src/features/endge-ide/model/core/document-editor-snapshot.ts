import { toRaw } from 'vue'

type SnapshotAdapter = (editor: Record<string, unknown>) => unknown

const TRANSIENT_EDITOR_KEYS = new Set([
  'bindingScope',
  'diagnostics',
  'effectiveProviderKey',
  'effectiveProviderOrigin',
  'flowEditor',
  'overridden',
  'selectedAccessorIndex',
  'selectedColumns',
  'selectedFieldIndex',
  'sourceParts',
])

const DEFAULT_EDITOR_NAMES = [
  'RAuthProfileEditor',
  'RComponentDSLEditor',
  'RComponentSFCEditor',
  'RComponentTableEditor',
  'RCompositionEditor',
  'RComputationEditor',
  'RConverterEditor',
  'RDataViewEditor',
  'REnvironmentEditor',
  'RFilterEditor',
  'RI18nBundleEditor',
  'RIntegrationEditor',
  'RMockEditor',
  'RNavigationEditor',
  'RPageEditor',
  'RPageTemplateEditor',
  'RParameterEditor',
  'RPolicyEditor',
  'RProjectEditor',
  'RQueryEditor',
  'RStoreEditor',
  'RStyleEditor',
  'RTenantEditor',
  'RTypeEditor',
  'RVocabsEditor',
] as const

function captureDefaultEditorState(editor: Record<string, unknown>): unknown {
  return editor
}

function captureActionEditorState(editor: Record<string, unknown>): unknown {
  const state = { ...editor }
  const flowEditor = editor.flowEditor as { toDefinition?: () => unknown } | null | undefined
  if (editor.overridden !== true && typeof flowEditor?.toDefinition === 'function') {
    state.definition = flowEditor.toDefinition()
  }
  return state
}

/** Explicit coverage registry for every persisted document editor family. */
export const DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS: ReadonlyMap<string, SnapshotAdapter> = new Map([
  ['RActionEditor', captureActionEditorState],
  ...DEFAULT_EDITOR_NAMES.map(name => [name, captureDefaultEditorState] as const),
])

/** Builds a deterministic snapshot from the authoring fields of an editor model. */
export function createDocumentEditorSnapshot(editor: unknown): string {
  if (!editor || typeof editor !== 'object') {
    return JSON.stringify(null)
  }

  const rawEditor = toRaw(editor as object) as Record<string, unknown>
  const editorName = rawEditor.constructor?.name ?? ''
  const adapter = DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS.get(editorName) ?? captureDefaultEditorState
  return JSON.stringify(canonicalize(adapter(rawEditor)))
}

function canonicalize(value: unknown, ancestors = new WeakSet<object>()): unknown {
  const raw = value && typeof value === 'object' ? toRaw(value as object) : value

  if (raw == null || typeof raw === 'string' || typeof raw === 'boolean') {
    return raw
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (typeof raw === 'bigint') {
    return String(raw)
  }
  if (typeof raw === 'function' || typeof raw === 'symbol' || typeof raw === 'undefined') {
    return undefined
  }
  if (raw instanceof Date) {
    return raw.toISOString()
  }
  if (ancestors.has(raw as object)) {
    throw new Error('Document editor snapshot contains a circular reference.')
  }

  ancestors.add(raw as object)
  try {
    if (Array.isArray(raw)) {
      return raw.map(item => canonicalize(item, ancestors))
    }
    if (raw instanceof Map) {
      return [...raw.entries()]
        .map(([key, item]) => [canonicalize(key, ancestors), canonicalize(item, ancestors)] as const)
        .sort(([left], [right]) => String(JSON.stringify(left)).localeCompare(String(JSON.stringify(right))))
    }
    if (raw instanceof Set) {
      return [...raw.values()]
        .map(item => canonicalize(item, ancestors))
        .sort((left, right) => String(JSON.stringify(left)).localeCompare(String(JSON.stringify(right))))
    }

    const entries = Object.entries(raw as Record<string, unknown>)
      .filter(([key, item]) => !TRANSIENT_EDITOR_KEYS.has(key) && item !== undefined && typeof item !== 'function')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item, ancestors)] as const)
    return Object.fromEntries(entries)
  }
  finally {
    ancestors.delete(raw as object)
  }
}
