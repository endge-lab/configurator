import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiTextDefinition = {
  id: 'ui.text',
  title: 'Text',
  description: 'Базовый текстовый блок для заголовков, описаний и подписей.',
  groupId: 'content',
  groupTitle: 'Content',
  groupDescription: 'Базовые контентные блоки.',
  primitiveKind: 'text',
  jsxTag: 'Text',
  supportsChildren: false,
  paletteVisible: true,
  canvasAccentClass: 'from-amber-400/35 to-orange-500/15',
  keywords: ['text', 'heading', 'paragraph', 'label'],
  configKind: null,
  defaultNodeName: 'Text',
  defaultProps: {
    text: 'Text',
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 2,
  },
  presentationContract: {
    id: 'presentation.ui.text',
    roles: [
      {
        role: 'main',
        description: 'Основной текстовый рендерер.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.text.canvas',
          admin: 'ui.text.admin',
          runtime: 'ui.text.runtime',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
