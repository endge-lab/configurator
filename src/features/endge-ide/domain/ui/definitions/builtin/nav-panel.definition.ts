import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiNavPanelDefinition = {
  id: 'ui.nav-panel',
  title: 'Nav Panel',
  description: 'Контейнер навигации, который позже сможет ссылаться на UI Navigation config.',
  groupId: 'navigation',
  groupTitle: 'Navigation',
  groupDescription: 'Навигационные блоки и панели.',
  primitiveKind: 'box',
  jsxTag: 'NavPanel',
  supportsChildren: true,
  paletteVisible: true,
  canvasAccentClass: 'from-emerald-400/35 to-teal-500/15',
  keywords: ['navigation', 'menu', 'sidebar'],
  configKind: 'navigation',
  defaultNodeName: 'Nav Panel',
  defaultProps: {
    title: 'Nav Panel',
    padding: 12,
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 6,
  },
  stubDescription: 'Definition навигации. Конкретная структура пунктов будет жить в UI Navigation config.',
  presentationContract: {
    id: 'presentation.ui.nav-panel',
    roles: [
      {
        role: 'main',
        description: 'Основной navigation renderer.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.nav-panel.canvas',
          admin: 'ui.nav-panel.admin',
          runtime: 'ui.nav-panel.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
