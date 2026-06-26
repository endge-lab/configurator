import type { UIComponentDefinition } from '@/features/endge-admin/domain/ui/definitions/UIComponentDefinition'

export const uiBoxDefinition = {
  id: 'ui.box',
  title: 'Box',
  description: 'Нейтральный контейнер для группировки и секционирования.',
  groupId: 'layout',
  groupTitle: 'Layout',
  groupDescription: 'Контейнеры и layout-примитивы.',
  primitiveKind: 'box',
  jsxTag: 'Box',
  supportsChildren: true,
  paletteVisible: true,
  canvasAccentClass: 'from-emerald-400/35 to-green-500/15',
  keywords: ['box', 'section', 'panel', 'container'],
  configKind: null,
  defaultNodeName: 'Box',
  defaultProps: {
    title: 'Box',
    padding: 8,
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 4,
  },
  presentationContract: {
    id: 'presentation.ui.box',
    roles: [
      {
        role: 'main',
        description: 'Основная визуализация контейнера.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.box.canvas',
          admin: 'ui.box.admin',
          runtime: 'ui.box.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
