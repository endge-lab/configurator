import { describe, expect, it } from 'vitest'

import {
  createDocumentEditorSnapshot,
  DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS,
} from '@/features/endge-ide/modules/tabs/document-editor-snapshot'

const EXPECTED_EDITOR_FAMILIES = [
  'RActionEditor',
  'RAuthProfileEditor',
  'RComponentDSLEditor',
  'RComponentSFCEditor',
  'RComponentTableEditor',
  'RCompositionEditor',
  'RComputationEditor',
  'RConfigurationEditor',
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
  'RStreamEditor',
  'RStyleEditor',
  'RTenantEditor',
  'RTypeEditor',
  'RUpdateEditor',
  'RVocabsEditor',
]

describe('document editor snapshot', () => {
  it('declares snapshot coverage for every persisted editor family', () => {
    expect([...DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS.keys()].sort()).toEqual(EXPECTED_EDITOR_FAMILIES)
  })

  it('detects authoring changes and becomes equal again after a revert', () => {
    const editor = {
      identity: 'orders',
      source: 'defineType({})',
    }
    const saved = createDocumentEditorSnapshot(editor)

    editor.source = 'defineType({ id: field(ID) })'
    expect(createDocumentEditorSnapshot(editor)).not.toBe(saved)

    editor.source = 'defineType({})'
    expect(createDocumentEditorSnapshot(editor)).toBe(saved)
  })

  it('ignores diagnostics and selection-only editor state', () => {
    const editor = {
      identity: 'orders',
      source: 'query({})',
      diagnostics: [] as unknown[],
      selectedFieldIndex: null as number | null,
      selectedColumns: [] as unknown[],
    }
    const saved = createDocumentEditorSnapshot(editor)

    editor.diagnostics = [{ message: 'Preview warning' }]
    editor.selectedFieldIndex = 2
    editor.selectedColumns = [{ id: 'visual-selection' }]

    expect(createDocumentEditorSnapshot(editor)).toBe(saved)
  })

  it('tracks canonical Action Source directly', () => {
    const editor = {
      constructor: { name: 'RActionEditor' },
      identity: 'orders.refresh',
      source: `defineAction({ steps: { result: input() } })`,
    }
    const saved = createDocumentEditorSnapshot(editor)
    editor.source = `defineAction({ steps: { result: input().trim() } })`
    expect(createDocumentEditorSnapshot(editor)).not.toBe(saved)
  })
})
