import { describe, expect, it } from 'vitest'

import { EndgeFlowEditorModel } from '@/features/endge-ide/domain/action-flow/EndgeFlowEditorModel'
import {
  createDocumentEditorSnapshot,
  DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS,
} from '@/features/endge-ide/model/core/document-editor-snapshot'

const EXPECTED_EDITOR_FAMILIES = [
  'RActionEditor',
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
]

describe('document editor snapshot', () => {
  it('declares snapshot coverage for every persisted editor family', () => {
    expect([...DOCUMENT_EDITOR_SNAPSHOT_ADAPTERS.keys()].sort()).toEqual(EXPECTED_EDITOR_FAMILIES)
  })

  it('detects authoring changes and becomes equal again after a revert', () => {
    const editor = {
      identity: 'orders',
      source: 'defineType({})',
      fields: new Map([['id', { type: 'ID', optional: false }]]),
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

  it('uses the live Action flow definition instead of its last synchronized copy', () => {
    const flowEditor = new EndgeFlowEditorModel()
    flowEditor.fillFromDefinition({ version: 1, entrypoint: 'entry', nodes: [], edges: [] })
    const editor = {
      constructor: { name: 'RActionEditor' },
      identity: 'orders.refresh',
      overridden: false,
      definition: { version: 1, entrypoint: 'entry', nodes: [], edges: [] },
      flowEditor,
    }
    const saved = createDocumentEditorSnapshot(editor)

    flowEditor.fillFromDefinition({
      version: 1,
      entrypoint: 'entry',
      nodes: [{ id: 'entry', title: 'Entry', blockId: 'flow.entry', kind: 'action' }],
      edges: [],
    })

    expect(createDocumentEditorSnapshot(editor)).not.toBe(saved)
  })
})
