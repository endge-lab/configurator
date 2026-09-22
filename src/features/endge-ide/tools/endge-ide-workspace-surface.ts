import type { LayoutWidgetsState, WidgetPosition } from '@/components/layouts/grid/types'

import { ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID } from '@/features/endge-admin-ui-editor/entities/ui-editor-workspace'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-ide/domain/types/runtime-preview.types'

/** Виджеты, временно заменяющие основную поверхность редактора. */
export const ENDGE_IDE_STANDALONE_WORKSPACE_WIDGET_IDS = [
  ENDGE_IDE_RUNTIME_TREE_WIDGET_ID,
  ENDGE_IDE_PROBLEMS_WIDGET_ID,
  ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID,
] as const

type DockableWidgetPosition = Extract<WidgetPosition, 'left' | 'right' | 'bottom'>

function isDockablePosition(position: WidgetPosition | undefined): position is DockableWidgetPosition {
  return position === 'left' || position === 'right' || position === 'bottom'
}

/** Возвращает true, когда отдельный виджет сейчас заменяет поверхность вкладки редактора. */
export function isStandaloneWorkspaceWidgetActive(
  widgets: LayoutWidgetsState,
  widgetId: string,
): boolean {
  const position = widgets.definitions[widgetId]?.position
  if (!isDockablePosition(position)) {
    return false
  }

  const area = widgets.areas[position]
  return area.expanded && area.activeWidget === widgetId
}

/** Обычная поверхность редактора видна, только пока ею не владеет отдельное рабочее пространство. */
export function isEditorTabSurfaceVisible(widgets: LayoutWidgetsState): boolean {
  return !ENDGE_IDE_STANDALONE_WORKSPACE_WIDGET_IDS.some(widgetId =>
    isStandaloneWorkspaceWidgetActive(widgets, widgetId),
  )
}
