import { toRaw } from 'vue'

// Внутренняя поддержка snapshot принадлежит модулю tabs.

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
  'RSimulationEditor',
  'RConfigurationEditor',
  'RComputationEditor',
  'RConverterEditor',
  'RDataViewEditor',
  'RFacetDocumentEditor',
  'RFilterEditor',
  'RI18nBundleEditor',
  'RIntegrationEditor',
  'RMockEditor',
  'RNavigationEditor',
  'RPageEditor',
  'RPageTemplateEditor',
  'RPolicyEditor',
  'RQueryEditor',
  'RStoreEditor',
  'RStreamEditor',
  'RUpdateEditor',
  'RStyleEditor',
  'RTypeEditor',
  'RVocabsEditor',
] as const

function captureDefaultEditorState(editor: Record<string, unknown>): unknown {
  return editor
}

// Явный реестр покрытия для каждого семейства редакторов сохраняемых документов.
export const DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS: ReadonlyMap<string, SnapshotAdapter> = new Map([
  ['RActionEditor', captureDefaultEditorState],
  ...DEFAULT_EDITOR_NAMES.map(name => [name, captureDefaultEditorState] as const),
])

// Строит детерминированный snapshot из authoring-полей модели редактора.
export function createDocumentEditorSnapshot(editor: unknown): string {
  if (!editor || typeof editor !== 'object') {
    return JSON.stringify(null)
  }

  const editorState = editor as Record<string, unknown>
  const editorName = toRaw(editorState).constructor?.name ?? ''
  const adapter = DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS.get(editorName) ?? captureDefaultEditorState
  return JSON.stringify(canonicalize(adapter(editorState)))
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
    if (Array.isArray(value)) {
      return value.map(item => canonicalize(item, ancestors))
    }
    if (value instanceof Map) {
      return [...value.entries()]
        .map(([key, item]) => [canonicalize(key, ancestors), canonicalize(item, ancestors)] as const)
        .sort(([left], [right]) => String(JSON.stringify(left)).localeCompare(String(JSON.stringify(right))))
    }
    if (value instanceof Set) {
      return [...value.values()]
        .map(item => canonicalize(item, ancestors))
        .sort((left, right) => String(JSON.stringify(left)).localeCompare(String(JSON.stringify(right))))
    }

    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .filter(key => !TRANSIENT_EDITOR_KEYS.has(key))
      .sort((left, right) => left.localeCompare(right))
      .map(key => [key, canonicalize(record[key], ancestors)])
    return Object.fromEntries(entries)
  }
  finally {
    ancestors.delete(raw as object)
  }
}
