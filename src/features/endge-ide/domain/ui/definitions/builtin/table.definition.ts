import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiTableDefinition = {
  id: 'ui.table',
  title: 'Table',
  description: 'Definition таблицы. Конкретная таблица с колонками будет жить в отдельном UI Table config.',
  groupId: 'data',
  groupTitle: 'Data',
  groupDescription: 'Таблицы и data-ориентированные блоки.',
  primitiveKind: 'custom-component',
  jsxTag: 'Table',
  supportsChildren: false,
  paletteVisible: true,
  canvasAccentClass: 'from-indigo-400/35 to-cyan-500/15',
  keywords: ['table', 'data', 'rows', 'columns'],
  configKind: 'table',
  defaultNodeName: 'Table',
  defaultProps: {
    title: 'Table',
    rendererRef: '',
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 6,
  },
  stubDescription: 'Definition таблицы. Конкретные колонки и data-binding будут подключаться через UI Table config.',
  presentationContract: {
    id: 'presentation.ui.table',
    roles: [
      {
        role: 'main',
        description: 'Основной рендер таблицы.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.table.canvas',
          admin: 'ui.table.admin',
          runtime: 'ui.table.runtime',
        },
      },
      {
        role: 'config',
        description: 'Конфигуратор таблицы.',
        supportedSurfaces: ['admin'],
        defaultRendererRefs: {
          admin: 'ui.table.config',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
