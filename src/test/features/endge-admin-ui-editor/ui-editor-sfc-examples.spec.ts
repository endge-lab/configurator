import { compileComponentSFC } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { UI_EDITOR_SFC_DEFINITION_CONTRACTS } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'
import { UI_EDITOR_SFC_EXAMPLES } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-examples'
import { projectUIEditorDocumentFromSFC } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-source'

describe('ui editor SFC examples', () => {
  it('covers every primitive tag exposed by the library', () => {
    const contractTags = new Set(UI_EDITOR_SFC_DEFINITION_CONTRACTS.map(contract => contract.tag))
    const exampleTags = new Set(UI_EDITOR_SFC_EXAMPLES.map(example => example.tag))

    expect(exampleTags).toEqual(contractTags)
  })

  it.each(UI_EDITOR_SFC_EXAMPLES)('$title is a complete compilable and visual example', (example) => {
    expect(example.source).toContain('defineProps<')
    expect(example.source).toContain('definePreviewProps({')

    const compilation = compileComponentSFC(example.source)
    expect(compilation.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([])
    expect(compilation.previewProps).not.toBeNull()

    const projection = projectUIEditorDocumentFromSFC(example.source)
    expect(projection.diagnostics).toEqual([])
    expect(projection.document).not.toBeNull()
  })
})
