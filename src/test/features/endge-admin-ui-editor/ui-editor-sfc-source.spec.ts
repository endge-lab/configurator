import { describe, expect, it } from 'vitest'

import {
  getUIEditorSFCAttributeBindings,
  getUIEditorSFCContentPreview,
  getUIEditorSFCTextSegments,
  hasUIEditorSFCBinding,
  hasUIEditorSFCTextBinding,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import { patchUIEditorSFCTemplate, projectUIEditorDocumentFromSFC } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-source'
import { createUIEditorModule } from '@/features/endge-admin-ui-editor/modules/ui-editor/UIEditor_Module'

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

describe('проекция SFC Source в UI-редакторе', () => {
  it('проецирует поддерживаемые базовые теги в визуальный документ', () => {
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

  it('повторно использует стабильные ID узлов для одинаковых структурных путей', () => {
    const first = projectUIEditorDocumentFromSFC(SOURCE).document!
    const firstTextId = first.nodes[first.rootId]!.children[0]!
    const nextSource = SOURCE.replace('<Text>Hello</Text>', '<Text>Updated</Text>')

    const second = projectUIEditorDocumentFromSFC(nextSource, first).document!

    expect(second.nodes[second.rootId]!.children[0]).toBe(firstTextId)
    expect(second.nodes[firstTextId]!.props).toMatchObject({ text: 'Updated' })
  })

  it('связывает вложенные визуальные узлы с точными диапазонами Source в обоих направлениях', () => {
    const state = createUIEditorModule()
    expect(state.applySFCSource(SOURCE)).toBe(true)

    const root = state.document.nodes[state.document.rootId]!
    const row = state.document.nodes[root.children[1]!]!
    const inputId = row.children[0]!
    const inputOffset = SOURCE.indexOf('<Input') + 2
    const inputLocation = state.getSourceLocation(inputId)

    expect(inputLocation).not.toBeNull()
    expect(SOURCE.slice(inputLocation!.openingTagRange.start, inputLocation!.openingTagRange.end)).toBe('<Input />')
    expect(state.findSourceNodeAtOffset(inputOffset)).toBe(inputId)

    state.selectNode(inputId, 'source')
    expect(state.selectedNodeId).toBe(inputId)
    expect(state.selectionOrigin).toBe('source')

    state.selectNode(root.id)
    expect(state.selectionOrigin).toBe('visual')
  })

  it('оставляет дочерние узлы Flex в потоке и удаляет устаревшее скрытое размещение Grid', () => {
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

  it('сохраняет контейнер Grid и размещение дочерних узлов при двустороннем преобразовании через Source', () => {
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

  it('сохраняет семантику корневого layout Flex в визуальной проекции и при двустороннем преобразовании Source', () => {
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

  it('использует направление Flex по умолчанию из runtime, если direction не задан', () => {
    const projected = projectUIEditorDocumentFromSFC('<template><Flex><Text>A</Text><Text>B</Text></Flex></template>')

    expect(projected.diagnostics).toEqual([])
    const root = projected.document!.nodes[projected.document!.rootId]!
    expect(root.props).toMatchObject({ direction: 'row' })
  })

  it('проецирует сокращённые свойства Flex и безопасно сохраняет принадлежащий Source синтаксис SFC при двустороннем преобразовании', () => {
    const source = `<script setup lang="ts">
defineProps<{ mode: 'create' | 'edit', flight: { daysOfWeek: boolean[] } }>()
definePreviewProps({ mode: 'edit', flight: { daysOfWeek: [true, false] } })
</script>

<template>
  <Flex col gap="4" w="100%" maxW="800px" p="6" bg="background">
    <Flex row gap="3" align="center" justify="space-between">
      <Text if="mode === 'edit'" size="24" weight="600">Рейс</Text>
      <Badge if="mode === 'create'" tone="info">Новый рейс</Badge>
    </Flex>
    <Box w="100%" p="6" bg="surface" borderWidth="1" borderColor="muted" r="8">
      <Grid columns="12" gap="4">
        <Input colStart="1" colSpan="6" type="Time" w="100%" readonly />
        <Weekdays colStart="7" colSpan="6" :weekdays="flight.daysOfWeek" />
      </Grid>
    </Box>
  </Flex>
</template>`
    const projected = projectUIEditorDocumentFromSFC(source)

    expect(projected.diagnostics).toEqual([])
    const document = projected.document!
    const root = document.nodes[document.rootId]!
    const row = document.nodes[root.children[0]!]!
    const box = document.nodes[root.children[1]!]!
    const grid = document.nodes[box.children[0]!]!
    const weekdays = document.nodes[grid.children[1]!]!

    expect(root.props).toMatchObject({ direction: 'column', gap: 16, padding: 24 })
    expect(row.props).toMatchObject({ direction: 'row', gap: 12 })
    expect(box.props).toMatchObject({ padding: 24 })
    expect(grid.props).toMatchObject({ gap: 16 })
    expect(weekdays).toMatchObject({
      kind: 'custom-component',
      name: 'Weekdays',
      layout: { colStart: 7, span: 6 },
    })

    const patched = patchUIEditorSFCTemplate(source, document)
    expect(patched).toContain('<Flex direction="column" gap="16px" p="24px" w="100%" maxW="800px" bg="background">')
    expect(patched).toContain('if="mode === \'edit\'"')
    expect(patched).toContain('borderWidth="1" borderColor="muted" r="8"')
    expect(patched).toContain('<Input type="Time" w="100%" readonly colStart="1" colSpan="6" rowStart="1" rowSpan="2" />')
    expect(patched).toContain('<Weekdays colStart="7" colSpan="6" :weekdays="flight.daysOfWeek" />')
    expect(projectUIEditorDocumentFromSFC(patched).diagnostics).toEqual([])
  })

  it('сохраняет динамические атрибуты визуального layout вместо замены резервными значениями', () => {
    const source = `<script setup lang="ts">
defineProps<{ spacing: number }>()
definePreviewProps({ spacing: 3 })
</script>
<template><Flex col :gap="spacing"><Text>Dynamic</Text></Flex></template>`
    const document = projectUIEditorDocumentFromSFC(source).document!
    const patched = patchUIEditorSFCTemplate(source, document)

    expect(patched).toContain('<Flex direction="column" p="10px" :gap="spacing">')
    expect(patched).not.toContain('gap="10px"')
    expect(projectUIEditorDocumentFromSFC(patched).diagnostics).toEqual([])
  })

  it('не включает перенос Flex при явно заданном boolean-атрибуте false', () => {
    const projected = projectUIEditorDocumentFromSFC('<template><Flex wrap="false"><Text>A</Text><Text>B</Text></Flex></template>')

    expect(projected.diagnostics).toEqual([])
    const root = projected.document!.nodes[projected.document!.rootId]!
    expect(root.props).toMatchObject({ wrap: false })
  })

  it('изменяет только содержимое template и сохраняет script и style', () => {
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

  it('сохраняет принадлежащие Source динамические атрибуты в визуальной проекции', () => {
    const result = projectUIEditorDocumentFromSFC(`<script setup lang="ts"></script>
<template><Flex><Text :value="label" /></Flex></template>`)

    expect(result.diagnostics).toEqual([])
    const document = result.document!
    const text = document.nodes[document.nodes[document.rootId]!.children[0]!]!
    expect(getUIEditorSFCAttributeBindings(text)).toEqual([
      {
        name: 'value',
        expression: 'label',
        resolved: false,
      },
    ])
    expect(patchUIEditorSFCTemplate(`<script setup lang="ts"></script>
<template><Flex><Text :value="label" /></Flex></template>`, document)).toContain(':value="label"')
  })

  it('рендерит интерполяцию Text из литерального definePreviewProps и сохраняет её binding', () => {
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

  it('показывает исходную интерполяцию, если в definePreviewProps нет подходящего значения', () => {
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

  it('рендерит содержимое и tone Badge из definePreviewProps, сохраняя bindings', () => {
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

  it('оставляет неразрешённые выражения Badge видимыми в визуальной проекции', () => {
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

  it('оставляет привязанный к Source Text доступным только для чтения при встроенном визуальном редактировании', () => {
    const state = createUIEditorModule()
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

  it('синхронизирует Source и визуальное состояние в обоих направлениях', () => {
    const state = createUIEditorModule()

    expect(state.applySFCSource(SOURCE)).toBe(true)
    const textId = state.document.nodes[state.document.rootId]!.children[0]!
    state.patchNodeProps(textId, { text: 'Visual update' })

    expect(state.source).toContain('<Text>Visual update</Text>')
    expect(state.source).toContain(`const marker = 'preserve-me'`)

    state.selectNode(textId)
    state.clearSelection()
    expect(state.selectedNodeId).toBeNull()
  })

  it('хранит встроенные изменения текста локально до commit, а затем обновляет Source', () => {
    const state = createUIEditorModule()
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

  it('отменяет встроенный черновик без изменения визуального документа', () => {
    const state = createUIEditorModule()
    expect(state.applySFCSource(SOURCE)).toBe(true)
    const textId = state.document.nodes[state.document.rootId]!.children[0]!

    state.beginInlineEdit(textId)
    state.updateInlineEditDraft('Discard me')
    state.cancelInlineEdit()

    expect(state.document.nodes[textId]!.props).toMatchObject({ text: 'Hello' })
    expect(state.source).toContain('<Text>Hello</Text>')
  })

  it('предварительно показывает перестановку узлов без изменения Source и применяет её атомарно', () => {
    const state = createUIEditorModule()
    expect(state.applySFCSource(`<template>
  <Flex direction="column">
    <Text>First</Text>
    <Text>Second</Text>
    <Text>Third</Text>
  </Flex>
</template>`)).toBe(true)

    const root = state.document.nodes[state.document.rootId]!
    const [firstId, secondId, thirdId] = root.children
    const sourceBeforeDrag = state.source

    expect(state.beginNodeDrag(firstId!)).toBe(true)
    expect(state.previewNodeDragAround(root.id, thirdId!, true)).toBe(true)
    expect(state.getChildren(root.id).map(node => node.id)).toEqual([secondId, thirdId, firstId])
    expect(root.children).toEqual([firstId, secondId, thirdId])
    expect(state.source).toBe(sourceBeforeDrag)

    state.cancelNodeDrag()
    expect(state.getChildren(root.id).map(node => node.id)).toEqual([firstId, secondId, thirdId])
    expect(state.source).toBe(sourceBeforeDrag)

    expect(state.beginNodeDrag(firstId!)).toBe(true)
    expect(state.previewNodeDragAround(root.id, thirdId!, true)).toBe(true)
    expect(state.commitNodeDrag()).toBe(true)
    expect(root.children).toEqual([secondId, thirdId, firstId])
    expect(state.nodeDragSession).toBeNull()
    expect(state.source.indexOf('<Text>Second</Text>')).toBeLessThan(state.source.indexOf('<Text>First</Text>'))
    expect(state.source.indexOf('<Text>Third</Text>')).toBeLessThan(state.source.indexOf('<Text>First</Text>'))
  })

  it('сохраняет последнее корректное визуальное дерево, пока Source временно невалиден', () => {
    const state = createUIEditorModule()
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

  it('переключает панели независимо и оставляет видимой хотя бы одну панель', () => {
    const state = createUIEditorModule()

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

  it('хранит независимые пропорции разделителей для каждой комбинации панелей', () => {
    const state = createUIEditorModule()

    state.togglePanel('source')
    state.setPanelDividerBoundary(0, 0.8, false)
    expect(state.getActivePanelSizes()[0]).toBeCloseTo(0.8)
    expect(state.getActivePanelSizes()[1]).toBeCloseTo(0.2)

    state.togglePanel('preview')
    expect(state.getActivePanelSizes()).toEqual([0.32, 0.34, 0.34])

    state.togglePanel('preview')
    expect(state.getActivePanelSizes()[0]).toBeCloseTo(0.8)
  })

  it('открывает единое контекстное меню удаления для некорневых узлов и закрывает его после удаления', () => {
    const state = createUIEditorModule()
    expect(state.applySFCSource(SOURCE)).toBe(true)
    const rootId = state.document.rootId
    const childId = state.document.nodes[rootId]!.children[0]!

    expect(state.openContextMenu(rootId, 40, 60)).toBe(false)
    expect(state.contextMenu).toBeNull()

    expect(state.openContextMenu(childId, 40, 60)).toBe(true)
    expect(state.selectedNodeId).toBe(childId)
    expect(state.contextMenu).toEqual({ nodeId: childId, x: 40, y: 60 })

    state.removeNode(childId)
    expect(state.contextMenu).toBeNull()
    expect(state.document.nodes[childId]).toBeUndefined()
  })
})
