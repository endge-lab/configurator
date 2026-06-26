import type { UIComponentDefinition } from '@/features/endge-admin/domain/ui/definitions/UIComponentDefinition'

export const uiGridDefinition = {
  id: 'ui.grid',
  title: 'Grid',
  description: 'Grid-контейнер для многоколоночной композиции.',
  groupId: 'layout',
  groupTitle: 'Layout',
  groupDescription: 'Контейнеры и layout-примитивы.',
  primitiveKind: 'grid',
  jsxTag: 'Grid',
  supportsChildren: true,
  paletteVisible: true,
  canvasAccentClass: 'from-violet-400/35 to-purple-500/15',
  keywords: ['grid', 'columns', 'layout', 'section'],
  configKind: null,
  defaultNodeName: 'Grid',
  defaultProps: {
    columns: 2,
    gap: 8,
    padding: 8,
    minHeight: 160,
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 6,
  },
  presentationContract: {
    id: 'presentation.ui.grid',
    roles: [
      {
        role: 'main',
        description: 'Grid-компоновка.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.grid.canvas',
          admin: 'ui.grid.admin',
          runtime: 'ui.grid.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
