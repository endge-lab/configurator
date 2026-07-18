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

  it('keeps Flex children in flow and drops stale hidden grid placement', () => {
    const first = projectUIEditorDocumentFromSFC(SOURCE).document!
    const textId = first.nodes[first.rootId]!.children[0]!
    first.nodes[textId]!.layout = {
      colStart: 3,
      rowStart: 4,
      span: 5,
      rowSpan: 2,
    }

    const projected = projectUIEditorDocumentFromSFC(SOURCE, first).document!
    const root = projected.nodes[projected.rootId]!
    const text = projected.nodes[root.children[0]!]!
    const patched = patchUIEditorSFCTemplate(SOURCE, projected)

    expect(root.kind).toBe('page')
    expect(root.props).toMatchObject({ layoutMode: 'flex' })
    expect(text.layout).toMatchObject({ colStart: 1, rowStart: 1, span: 12 })
    expect(patched).not.toContain('colStart=')
    expect(patched).not.toContain('colSpan=')
  })

  it('round-trips Grid container and child placement through Source', () => {
    const source = `<template>
  <Grid columns="12" gap="10px" p="10px" autoRows="28px">
    <Text colStart="2" colSpan="5" rowStart="3" rowSpan="2">Placed</Text>
  </Grid>
</template>
`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const root = document.nodes[document.rootId]!
    const text = document.nodes[root.children[0]!]!
    expect(root.props).toMatchObject({
      layoutMode: 'grid',
      columns: 12,
      gap: 10,
      padding: 10,
      rowHeight: 28,
    })
    expect(text.layout).toEqual({ colStart: 2, rowStart: 3, span: 5, rowSpan: 2 })

    text.layout = { colStart: 1, rowStart: 1, span: 7, rowSpan: 3 }
    const patched = patchUIEditorSFCTemplate(source, document)

    expect(patched).toContain('<Grid columns="12" gap="10px" p="10px" autoRows="28px">')
    expect(patched).toContain('<Text colStart="1" colSpan="7" rowStart="1" rowSpan="3">Placed</Text>')
    expect(projectUIEditorDocumentFromSFC(patched).diagnostics).toEqual([])
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
