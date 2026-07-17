import type { WidgetDefinition } from '@/components/layouts/grid'

import { markRaw } from 'vue'

import { ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-preview/config/constants'
import RuntimeTree_Widget from '@/features/endge-preview/ui/widgets/RuntimeTree_Widget.vue'

export { ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-preview/config/constants'

/** Public feature-owned widget reused by standalone and embedded Preview hosts. */
export const endgePreviewRuntimeTreeWidget: WidgetDefinition = {
  id: ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID,
  title: 'Runtime tree',
  icon: 'Network',
  content: 'component',
  defaultComponent: markRaw(RuntimeTree_Widget),
  singleton: true,
  permanent: true,
  defaultPosition: 'left',
  allowedPositions: ['left'],
}

export const endgePreviewWidgetsConfig: WidgetDefinition[] = [endgePreviewRuntimeTreeWidget]
