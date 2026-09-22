import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiPageDefinition = {
  id: 'ui.page',
  title: 'Page',
  description: 'Корневой холст страницы для AST-композиции UI.',
  groupId: 'system',
  groupTitle: 'System',
  groupDescription: 'Системные definition-компоненты редактора.',
  primitiveKind: 'page',
  jsxTag: 'Page',
  supportsChildren: true,
  paletteVisible: false,
  canvasAccentClass: 'from-sky-400/35 to-blue-500/15',
  keywords: ['page', 'root', 'canvas'],
  configKind: null,
  defaultNodeName: 'Page',
  defaultProps: {
    title: 'Demo UI Page',
    gap: 10,
    padding: 10,
    rowHeight: 28,
  },
  presentationContract: {
    id: 'presentation.ui.page',
    roles: [
      {
        role: 'main',
        description: 'Основная визуализация страницы.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.page.canvas',
          admin: 'ui.page.admin',
          runtime: 'ui.page.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
