import type { UIComponentDefinition } from '@/features/endge-admin/domain/ui/definitions/UIComponentDefinition'

export const uiButtonDefinition = {
  id: 'ui.button',
  title: 'Button',
  description: 'Кнопка действия или перехода.',
  groupId: 'actions',
  groupTitle: 'Actions',
  groupDescription: 'Кнопки и action-элементы.',
  primitiveKind: 'button',
  jsxTag: 'Button',
  supportsChildren: false,
  paletteVisible: true,
  canvasAccentClass: 'from-sky-400/35 to-blue-500/15',
  keywords: ['button', 'action', 'cta'],
  configKind: null,
  defaultNodeName: 'Button',
  defaultProps: {
    label: 'Button',
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 2,
  },
  presentationContract: {
    id: 'presentation.ui.button',
    roles: [
      {
        role: 'main',
        description: 'Основная кнопка.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.button.canvas',
          admin: 'ui.button.admin',
          runtime: 'ui.button.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
