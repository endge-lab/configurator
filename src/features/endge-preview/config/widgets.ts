import type { WidgetDefinition } from '@/components/layouts/grid'

import { markRaw } from 'vue'

import RuntimeTree_Widget from '@/features/endge-preview/ui/widgets/RuntimeTree_Widget.vue'

export const endgePreviewWidgetsConfig: WidgetDefinition[] = [
  {
    id: 'preview-runtime-tree',
    title: 'Runtime tree',
    icon: 'Network',
    content: 'component',
    defaultComponent: markRaw(RuntimeTree_Widget),
    singleton: true,
    permanent: true,
    defaultPosition: 'left',
    allowedPositions: ['left'],
  },
]
