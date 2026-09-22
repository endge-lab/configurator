import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiStackDefinition = {
  id: 'ui.stack',
  title: 'Stack',
  description: 'Вертикальный layout-контейнер для колонок и списков.',
  groupId: 'layout',
  groupTitle: 'Layout',
  groupDescription: 'Контейнеры и layout-примитивы.',
  primitiveKind: 'flex',
  jsxTag: 'Stack',
  supportsChildren: true,
  paletteVisible: true,
  canvasAccentClass: 'from-fuchsia-400/35 to-pink-500/15',
  keywords: ['stack', 'vstack', 'column', 'layout'],
  configKind: null,
  defaultNodeName: 'Stack',
  defaultProps: {
    direction: 'column',
    gap: 8,
    padding: 8,
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 6,
  },
  presentationContract: {
    id: 'presentation.ui.stack',
    roles: [
      {
        role: 'main',
        description: 'Вертикальная компоновка.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.stack.canvas',
          admin: 'ui.stack.admin',
          runtime: 'ui.stack.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
