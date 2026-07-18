import { describe, expect, it } from 'vitest'

import { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import { patchUIEditorSFCTemplate, projectUIEditorDocumentFromSFC } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-source'

const SOURCE = `<script setup lang="ts">
const marker = 'preserve-me'
</script>

<template>
  <Flex direction="column" gap="12px" p="16px">
    <Text>Hello</Text>
    <Flex direction="row" gap="4px">
      <Input />
      <Checkbox />
    </Flex>
  </Flex>
</template>

<style lang="endgecss" scoped>
Text { color: green; }
</style>
`

describe('ui editor SFC source projection', () => {
  it('projects supported base tags into the visual document', () => {
    const result = projectUIEditorDocumentFromSFC(SOURCE)

    expect(result.diagnostics).toEqual([])
    expect(result.document).not.toBeNull()

    const document = result.document!
    const root = document.nodes[document.rootId]!
    const text = document.nodes[root.children[0]!]!
    const row = document.nodes[root.children[1]!]!

    expect(root.kind).toBe('page')
    expect(root.props).toMatchObject({ gap: 12, padding: 16 })
    expect(text.kind).toBe('text')
    expect(text.props).toMatchObject({ text: 'Hello' })
    expect(row.kind).toBe('flex')
    expect(row.props).toMatchObject({ direction: 'row', gap: 4 })
    expect(row.children).toHaveLength(2)
  })

  it('reuses stable node ids for the same structural paths', () => {
    const first = projectUIEditorDocumentFromSFC(SOURCE).document!
    const firstTextId = first.nodes[first.rootId]!.children[0]!
    const nextSource = SOURCE.replace('<Text>Hello</Text>', '<Text>Updated</Text>')

    const second = projectUIEditorDocumentFromSFC(nextSource, first).document!

    expect(second.nodes[second.rootId]!.children[0]).toBe(firstTextId)
    expect(second.nodes[firstTextId]!.props).toMatchObject({ text: 'Updated' })
  })

  it('patches only template content and preserves script and style', () => {
    const document = projectUIEditorDocumentFromSFC(SOURCE).document!
    const textId = document.nodes[document.rootId]!.children[0]!
    const text = document.nodes[textId]!
    if (text.kind === 'text') {
      text.props.text = 'Changed visually'
    }

    const patched = patchUIEditorSFCTemplate(SOURCE, document)

    expect(patched).toContain(`const marker = 'preserve-me'`)
    expect(patched).toContain('Text { color: green; }')
    expect(patched).toContain('<Text>Changed visually</Text>')
    expect(projectUIEditorDocumentFromSFC(patched).diagnostics).toEqual([])
  })

  it('keeps unsupported dynamic source out of the visual projection', () => {
    const result = projectUIEditorDocumentFromSFC(`<script setup lang="ts"></script>
<template><Flex><Text :value="label" /></Flex></template>`)

    expect(result.document).toBeNull()
    expect(result.diagnostics.join(' ')).toContain('dynamic binding')
  })

  it('synchronizes source and visual state in both directions', () => {
    const state = new UIEditorDemoState()

    expect(state.applySFCSource(SOURCE)).toBe(true)
    const textId = state.document.nodes[state.document.rootId]!.children[0]!
    state.patchNodeProps(textId, { text: 'Visual update' })

    expect(state.source).toContain('<Text>Visual update</Text>')
    expect(state.source).toContain(`const marker = 'preserve-me'`)

    state.selectNode(textId)
    state.clearSelection()
    expect(state.selectedNodeId).toBeNull()
  })

  it('keeps the last valid visual tree while source is temporarily invalid', () => {
    const state = new UIEditorDemoState()
    expect(state.applySFCSource(SOURCE)).toBe(true)
    const previousRootId = state.document.rootId

    expect(state.applySFCSource('<template><Flex>')).toBe(false)

    expect(state.document.rootId).toBe(previousRootId)
    expect(state.source).toBe('<template><Flex>')
    expect(state.sourceDiagnostics.length).toBeGreaterThan(0)

    const previousChildrenCount = state.document.nodes[previousRootId]!.children.length
    expect(state.addNode('ui.text')).toBeNull()
    expect(state.document.nodes[previousRootId]!.children).toHaveLength(previousChildrenCount)
    expect(state.source).toBe('<template><Flex>')
  })
})
