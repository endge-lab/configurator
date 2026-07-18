import type { UIEditorNodeKind, UIEditorNodeLayout } from '@/features/endge-admin-ui-editor/types'

export type UIEditorSFCBaseTag
  = | 'Text'
    | 'DateTime'
    | 'Number'
    | 'Icon'
    | 'Badge'
    | 'Dot'
    | 'Box'
    | 'Flex'
    | 'Divider'
    | 'Input'
    | 'Textarea'
    | 'Checkbox'
    | 'Select'

export interface UIEditorSFCDefinitionContract {
  definitionRef: string
  tag: UIEditorSFCBaseTag
  label: string
  description: string
  groupId: 'layout' | 'content' | 'forms'
  groupTitle: string
  groupDescription: string
  kind: Exclude<UIEditorNodeKind, 'page'>
  supportsChildren: boolean
  accentClass: string
  defaultProps: Record<string, unknown>
  defaultLayout: UIEditorNodeLayout
  keywords: string[]
}

const DEFAULT_LEAF_LAYOUT: UIEditorNodeLayout = {
  colStart: 1,
  rowStart: 1,
  span: 6,
  rowSpan: 2,
}

function leafContract(input: {
  tag: Exclude<UIEditorSFCBaseTag, 'Text' | 'Box' | 'Flex'>
  groupId?: 'content' | 'forms'
  description: string
  keywords: string[]
  layout?: Partial<UIEditorNodeLayout>
}): UIEditorSFCDefinitionContract {
  const groupId = input.groupId ?? 'content'
  return {
    definitionRef: `sfc.${input.tag.toLowerCase()}`,
    tag: input.tag,
    label: input.tag,
    description: input.description,
    groupId,
    groupTitle: groupId === 'forms' ? 'Forms' : 'Content',
    groupDescription: groupId === 'forms'
      ? 'Базовые renderer-neutral поля Endge SFC.'
      : 'Базовые renderer-neutral элементы содержимого Endge SFC.',
    kind: 'custom-component',
    supportsChildren: false,
    accentClass: groupId === 'forms'
      ? 'from-cyan-400/35 to-sky-500/15'
      : 'from-amber-400/35 to-orange-500/15',
    defaultProps: {
      title: input.tag,
      rendererRef: '',
    },
    defaultLayout: {
      ...DEFAULT_LEAF_LAYOUT,
      ...(input.layout ?? {}),
    },
    keywords: [input.tag.toLowerCase(), ...input.keywords],
  }
}

/** Feature-local authoring vocabulary matching the base Endge SFC adapter tags. */
export const UI_EDITOR_SFC_DEFINITION_CONTRACTS: readonly UIEditorSFCDefinitionContract[] = [
  {
    definitionRef: 'ui.text',
    tag: 'Text',
    label: 'Text',
    description: 'Базовый текстовый узел Endge SFC.',
    groupId: 'content',
    groupTitle: 'Content',
    groupDescription: 'Базовые renderer-neutral элементы содержимого Endge SFC.',
    kind: 'text',
    supportsChildren: false,
    accentClass: 'from-amber-400/35 to-orange-500/15',
    defaultProps: { text: 'Text' },
    defaultLayout: { ...DEFAULT_LEAF_LAYOUT, span: 12 },
    keywords: ['text', 'label', 'content'],
  },
  leafContract({
    tag: 'DateTime',
    description: 'Renderer-neutral вывод даты и времени.',
    keywords: ['date', 'time'],
  }),
  leafContract({
    tag: 'Number',
    description: 'Renderer-neutral вывод числового значения.',
    keywords: ['numeric', 'value'],
  }),
  leafContract({
    tag: 'Icon',
    description: 'Базовый icon primitive.',
    keywords: ['symbol', 'glyph'],
  }),
  leafContract({
    tag: 'Badge',
    description: 'Компактный badge для статуса или категории.',
    keywords: ['status', 'label'],
  }),
  leafContract({
    tag: 'Dot',
    description: 'Минимальный status dot primitive.',
    keywords: ['status', 'indicator'],
    layout: { span: 2, rowSpan: 1 },
  }),
  {
    definitionRef: 'ui.box',
    tag: 'Box',
    label: 'Box',
    description: 'Базовый SFC-контейнер для группировки содержимого.',
    groupId: 'layout',
    groupTitle: 'Layout',
    groupDescription: 'Renderer-neutral layout primitives Endge SFC.',
    kind: 'box',
    supportsChildren: true,
    accentClass: 'from-emerald-400/35 to-green-500/15',
    defaultProps: { title: 'Box', padding: 8 },
    defaultLayout: { ...DEFAULT_LEAF_LAYOUT, span: 12, rowSpan: 4 },
    keywords: ['box', 'container', 'section'],
  },
  {
    definitionRef: 'ui.stack',
    tag: 'Flex',
    label: 'Flex · Column',
    description: 'Flex container с вертикальным направлением.',
    groupId: 'layout',
    groupTitle: 'Layout',
    groupDescription: 'Renderer-neutral layout primitives Endge SFC.',
    kind: 'flex',
    supportsChildren: true,
    accentClass: 'from-fuchsia-400/35 to-pink-500/15',
    defaultProps: { direction: 'column', gap: 8, padding: 8 },
    defaultLayout: { ...DEFAULT_LEAF_LAYOUT, span: 12, rowSpan: 6 },
    keywords: ['flex', 'column', 'stack', 'layout'],
  },
  {
    definitionRef: 'ui.inline',
    tag: 'Flex',
    label: 'Flex · Row',
    description: 'Flex container с горизонтальным направлением.',
    groupId: 'layout',
    groupTitle: 'Layout',
    groupDescription: 'Renderer-neutral layout primitives Endge SFC.',
    kind: 'flex',
    supportsChildren: true,
    accentClass: 'from-fuchsia-400/35 to-pink-500/15',
    defaultProps: { direction: 'row', gap: 8, padding: 8 },
    defaultLayout: { ...DEFAULT_LEAF_LAYOUT, span: 12, rowSpan: 4 },
    keywords: ['flex', 'row', 'inline', 'layout'],
  },
  leafContract({
    tag: 'Divider',
    description: 'Разделитель между соседними блоками.',
    keywords: ['separator', 'line'],
    layout: { span: 12, rowSpan: 1 },
  }),
  leafContract({
    tag: 'Input',
    groupId: 'forms',
    description: 'Однострочное поле ввода.',
    keywords: ['field', 'control'],
  }),
  leafContract({
    tag: 'Textarea',
    groupId: 'forms',
    description: 'Многострочное поле ввода.',
    keywords: ['field', 'multiline'],
    layout: { span: 12, rowSpan: 4 },
  }),
  leafContract({
    tag: 'Checkbox',
    groupId: 'forms',
    description: 'Булево поле выбора.',
    keywords: ['field', 'boolean', 'toggle'],
  }),
  leafContract({
    tag: 'Select',
    groupId: 'forms',
    description: 'Поле выбора одного значения.',
    keywords: ['field', 'options', 'choice'],
  }),
]

export function getUIEditorSFCDefinitionContract(
  definitionRef: string,
): UIEditorSFCDefinitionContract | null {
  return UI_EDITOR_SFC_DEFINITION_CONTRACTS.find(contract => contract.definitionRef === definitionRef) ?? null
}
