import { describe, expect, it } from 'vitest'

import { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import {
  getUIEditorSFCAttributeBindings,
  getUIEditorSFCContentPreview,
  getUIEditorSFCTextSegments,
  hasUIEditorSFCBinding,
  hasUIEditorSFCTextBinding,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
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

  it('preserves root Flex layout semantics in visual projection and Source round-trip', () => {
    const source = `<template>
  <Flex direction="row" align="center" justify="space-between" wrap gap="12px" p="8px">
    <Text>Flight</Text>
    <Badge>Status</Badge>
  </Flex>
</template>`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const root = document.nodes[document.rootId]!
    expect(root.props).toMatchObject({
      layoutMode: 'flex',
      direction: 'row',
      align: 'center',
      justify: 'space-between',
      wrap: true,
      gap: 12,
      padding: 8,
    })

    const patched = patchUIEditorSFCTemplate(source, document)
    expect(patched).toContain('<Flex direction="row" align="center" justify="space-between" wrap gap="12px" p="8px">')
    expect(projectUIEditorDocumentFromSFC(patched).diagnostics).toEqual([])
  })

  it('uses the runtime Flex default direction when direction is omitted', () => {
    const projected = projectUIEditorDocumentFromSFC('<template><Flex><Text>A</Text><Text>B</Text></Flex></template>')

    expect(projected.diagnostics).toEqual([])
    const root = projected.document!.nodes[projected.document!.rootId]!
    expect(root.props).toMatchObject({ direction: 'row' })
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

  it('renders Text interpolation from literal definePreviewProps and preserves its binding', () => {
    const source = `<script setup lang="ts">
defineProps<{ flight: { status: string } }>()
definePreviewProps({ flight: { status: 'Boarding' } })
</script>

<template>
  <Flex><Text>Status: {{ flight.status }}</Text></Flex>
</template>
`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const text = document.nodes[document.nodes[document.rootId]!.children[0]!]!
    expect(text.props).toMatchObject({ text: 'Status: Boarding' })
    expect(hasUIEditorSFCTextBinding(text)).toBe(true)
    expect(getUIEditorSFCTextSegments(text)).toEqual([
      { kind: 'text', value: 'Status: ' },
      { kind: 'expression', expression: 'flight.status' },
    ])

    const patched = patchUIEditorSFCTemplate(source, document)
    expect(patched).toContain('<Text>Status: {{ flight.status }}</Text>')
    expect(patched).not.toContain('<Text>Status: Boarding</Text>')
  })

  it('shows the original interpolation when definePreviewProps has no matching value', () => {
    const source = `<script setup lang="ts">
defineProps<{ flight: { status: string } }>()
</script>

<template>
  <Flex><Text>{{ flight.status }}</Text></Flex>
</template>
`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const text = document.nodes[document.nodes[document.rootId]!.children[0]!]!
    expect(text.props).toMatchObject({ text: '{{ flight.status }}' })
    expect(patchUIEditorSFCTemplate(source, document)).toContain('<Text>{{ flight.status }}</Text>')
  })

  it('renders Badge content and tone from definePreviewProps while preserving bindings', () => {
    const source = `<script setup lang="ts">
defineProps<{
  flight: { number: string, status: string, statusTone: string }
}>()

definePreviewProps({
  flight: {
    number: 'SU 1402',
    status: 'Boarding',
    statusTone: 'success',
  },
})
</script>

<template>
  <Flex direction="row">
    <Text>{{ flight.number }}</Text>
    <Badge :tone="flight.statusTone">
      {{ flight.status }}
    </Badge>
  </Flex>
</template>
`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const root = document.nodes[document.rootId]!
    const text = document.nodes[root.children[0]!]!
    const badge = document.nodes[root.children[1]!]!

    expect(text.props).toMatchObject({ text: 'SU 1402' })
    expect(badge.definitionRef).toBe('sfc.badge')
    expect(getUIEditorSFCContentPreview(badge)).toBe('Boarding')
    expect(getUIEditorSFCAttributeBindings(badge)).toEqual([
      {
        name: 'tone',
        expression: 'flight.statusTone',
        resolved: true,
        previewValue: 'success',
      },
    ])
    expect(hasUIEditorSFCBinding(badge)).toBe(true)

    const patched = patchUIEditorSFCTemplate(source, document)
    expect(patched).toContain('<Badge :tone="flight.statusTone">{{ flight.status }}</Badge>')
    expect(patched).not.toContain('<Badge :tone="success">Boarding</Badge>')
    expect(projectUIEditorDocumentFromSFC(patched).diagnostics).toEqual([])
  })

  it('keeps unresolved Badge expressions visible in the visual projection', () => {
    const source = `<script setup lang="ts">
defineProps<{ flight: { status: string, statusTone: string } }>()
</script>
<template>
  <Flex><Badge :tone="flight.statusTone">{{ flight.status }}</Badge></Flex>
</template>`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const badge = document.nodes[document.nodes[document.rootId]!.children[0]!]!
    expect(getUIEditorSFCContentPreview(badge)).toBe('{{ flight.status }}')
    expect(getUIEditorSFCAttributeBindings(badge)).toEqual([
      {
        name: 'tone',
        expression: 'flight.statusTone',
        resolved: false,
      },
    ])
  })

  it('keeps source-bound Text read-only in inline visual editing', () => {
    const state = new UIEditorDemoState()
    expect(state.applySFCSource(`<script setup lang="ts">
defineProps<{ label: string }>()
definePreviewProps({ label: 'Preview label' })
</script>
<template><Flex><Text>{{ label }}</Text></Flex></template>`)).toBe(true)
    const textId = state.document.nodes[state.document.rootId]!.children[0]!

    expect(state.document.nodes[textId]!.props).toMatchObject({ text: 'Preview label' })
    expect(state.beginInlineEdit(textId)).toBe(false)
    expect(state.editingNodeId).toBeNull()
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

  it('keeps inline text edits local until commit and then updates Source', () => {
    const state = new UIEditorDemoState()
    expect(state.applySFCSource(SOURCE)).toBe(true)
    const textId = state.document.nodes[state.document.rootId]!.children[0]!
    const sourceBeforeEdit = state.source

    expect(state.beginInlineEdit(textId)).toBe(true)
    state.updateInlineEditDraft('Edited on canvas')

    expect(state.source).toBe(sourceBeforeEdit)
    expect(state.document.nodes[textId]!.props).toMatchObject({ text: 'Hello' })

    state.commitInlineEdit()

    expect(state.editingNodeId).toBeNull()
    expect(state.document.nodes[textId]!.props).toMatchObject({ text: 'Edited on canvas' })
    expect(state.source).toContain('<Text>Edited on canvas</Text>')
  })

  it('cancels an inline draft without changing the visual document', () => {
    const state = new UIEditorDemoState()
    expect(state.applySFCSource(SOURCE)).toBe(true)
    const textId = state.document.nodes[state.document.rootId]!.children[0]!

    state.beginInlineEdit(textId)
    state.updateInlineEditDraft('Discard me')
    state.cancelInlineEdit()

    expect(state.document.nodes[textId]!.props).toMatchObject({ text: 'Hello' })
    expect(state.source).toContain('<Text>Hello</Text>')
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

  it('toggles panels independently and keeps at least one panel visible', () => {
    const state = new UIEditorDemoState()

    expect(state.activePanels).toEqual(['visual'])
    expect(state.togglePanel('source')).toBe(true)
    expect(state.togglePanel('preview')).toBe(true)
    expect(state.activePanels).toEqual(['visual', 'source', 'preview'])

    expect(state.togglePanel('visual')).toBe(true)
    expect(state.activePanels).toEqual(['source', 'preview'])
    expect(state.togglePanel('source')).toBe(true)
    expect(state.activePanels).toEqual(['preview'])
    expect(state.togglePanel('preview')).toBe(false)
    expect(state.activePanels).toEqual(['preview'])
  })

  it('stores independent splitter proportions for each panel combination', () => {
    const state = new UIEditorDemoState()

    state.togglePanel('source')
    state.setPanelDividerBoundary(0, 0.8, false)
    expect(state.getActivePanelSizes()[0]).toBeCloseTo(0.8)
    expect(state.getActivePanelSizes()[1]).toBeCloseTo(0.2)

    state.togglePanel('preview')
    expect(state.getActivePanelSizes()).toEqual([0.32, 0.34, 0.34])

    state.togglePanel('preview')
    expect(state.getActivePanelSizes()[0]).toBeCloseTo(0.8)
  })
})
