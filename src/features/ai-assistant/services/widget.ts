import type { WidgetDefinition } from '@/components/layouts/grid'

import { defineAsyncComponent, markRaw } from 'vue'

export const AI_AGENT_WIDGET_ID = 'agent'

export const AI_AGENT_WIDGET_DEFINITION: WidgetDefinition = {
  id: AI_AGENT_WIDGET_ID,
  title: 'Агент',
  icon: 'Bot',
  iconClass: 'text-fuchsia-600 dark:text-[#C792EA]',
  content: 'component',
  defaultComponent: markRaw(defineAsyncComponent(() => import('@/features/ai-assistant/ui/AIWorkbench_Widget.vue'))),
  singleton: true,
  defaultPosition: 'right',
  allowedPositions: ['left', 'right', 'floating'],
  floatingConstraints: { minWidth: 320, maxWidth: 600, minHeight: 400, maxHeight: 800, defaultWidth: 420, defaultHeight: 560 },
}
