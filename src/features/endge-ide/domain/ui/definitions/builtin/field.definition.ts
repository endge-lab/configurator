import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiFieldDefinition = {
  id: 'ui.field',
  title: 'Field',
  description: 'Упрощённый field-host для будущих input/control renderer-вариантов.',
  groupId: 'forms',
  groupTitle: 'Forms',
  groupDescription: 'Формы и поля ввода.',
  primitiveKind: 'custom-component',
  jsxTag: 'Field',
  supportsChildren: false,
  paletteVisible: true,
  canvasAccentClass: 'from-indigo-400/35 to-cyan-500/15',
  keywords: ['field', 'input', 'control'],
  configKind: null,
  defaultNodeName: 'Field',
  defaultProps: {
    title: 'Field',
    rendererRef: '',
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 3,
  },
  stubDescription: 'Definition поля без конкретного runtime-control. На canvas показывается как placeholder-host.',
  presentationContract: {
    id: 'presentation.ui.field',
    roles: [
      {
        role: 'main',
        description: 'Основной field renderer.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.field.canvas',
          admin: 'ui.field.admin',
          runtime: 'ui.field.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
