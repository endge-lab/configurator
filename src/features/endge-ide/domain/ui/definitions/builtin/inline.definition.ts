import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiInlineDefinition = {
  id: 'ui.inline',
  title: 'Inline',
  description: 'Горизонтальный layout-контейнер для строчных композиций.',
  groupId: 'layout',
  groupTitle: 'Layout',
  groupDescription: 'Контейнеры и layout-примитивы.',
  primitiveKind: 'flex',
  jsxTag: 'Inline',
  supportsChildren: true,
  paletteVisible: true,
  canvasAccentClass: 'from-fuchsia-400/35 to-pink-500/15',
  keywords: ['inline', 'hstack', 'row', 'layout'],
  configKind: null,
  defaultNodeName: 'Inline',
  defaultProps: {
    direction: 'row',
    gap: 8,
    padding: 8,
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 4,
  },
  presentationContract: {
    id: 'presentation.ui.inline',
    roles: [
      {
        role: 'main',
        description: 'Горизонтальная компоновка.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.inline.canvas',
          admin: 'ui.inline.admin',
          runtime: 'ui.inline.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
