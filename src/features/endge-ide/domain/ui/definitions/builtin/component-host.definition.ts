import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const UI_COMPONENT_HOST_DEFINITION_ID = 'ui.component-host'

export const uiComponentHostDefinition = {
  id: UI_COMPONENT_HOST_DEFINITION_ID,
  title: 'Component Host',
  description: 'Системный placeholder для legacy/custom renderer-блоков.',
  groupId: 'system',
  groupTitle: 'System',
  groupDescription: 'Системные definition-компоненты редактора.',
  primitiveKind: 'custom-component',
  jsxTag: 'ComponentHost',
  supportsChildren: false,
  paletteVisible: false,
  canvasAccentClass: 'from-indigo-400/35 to-cyan-500/15',
  keywords: ['host', 'custom', 'legacy'],
  configKind: null,
  defaultNodeName: 'Component Host',
  defaultProps: {
    title: 'Component Host',
    rendererRef: '',
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 4,
  },
  defaultRendererRef: 'ui.component-host.canvas',
  allowsRendererRefOverride: true,
  stubDescription: 'Legacy-host для блоков, которые ещё не переведены на definition/config модель.',
  presentationContract: {
    id: 'presentation.ui.component-host',
    roles: [
      {
        role: 'main',
        description: 'Placeholder host для внешнего renderer.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.component-host.canvas',
          admin: 'ui.component-host.admin',
          runtime: 'ui.component-host.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
