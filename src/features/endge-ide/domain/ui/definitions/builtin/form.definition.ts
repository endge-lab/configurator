import type { UIComponentDefinition } from '@/features/endge-ide/domain/ui/definitions/UIComponentDefinition'

export const uiFormDefinition = {
  id: 'ui.form',
  title: 'Form',
  description: 'Контейнер формы, который позже будет связан с UI Form config.',
  groupId: 'forms',
  groupTitle: 'Forms',
  groupDescription: 'Формы и поля ввода.',
  primitiveKind: 'box',
  jsxTag: 'Form',
  supportsChildren: true,
  paletteVisible: true,
  canvasAccentClass: 'from-emerald-400/35 to-teal-500/15',
  keywords: ['form', 'fields', 'submit'],
  configKind: 'form',
  defaultNodeName: 'Form',
  defaultProps: {
    title: 'Form',
    padding: 12,
  },
  defaultLayout: {
    colStart: 1,
    rowStart: 1,
    span: 12,
    rowSpan: 6,
  },
  stubDescription: 'Definition-контейнер формы. Конкретный набор полей будет приходить из UI Form config.',
  presentationContract: {
    id: 'presentation.ui.form',
    roles: [
      {
        role: 'main',
        description: 'Основной рендер формы.',
        supportedSurfaces: ['canvas', 'admin', 'runtime'],
        defaultRendererRefs: {
          canvas: 'ui.form.canvas',
          admin: 'ui.form.admin',
          runtime: 'ui.form.runtime',
        },
      },
      {
        role: 'config',
        description: 'Конфигуратор формы.',
        supportedSurfaces: ['admin'],
        defaultRendererRefs: {
          admin: 'ui.form.config',
        },
      },
    ],
  },
} satisfies UIComponentDefinition
