import type { LayoutWidgetsState, WidgetPosition } from '@/components/layouts/grid/types'

import { ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID } from '@/features/endge-admin-ui-editor/entities/ui-editor-workspace'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-ide/domain/types/runtime-preview.types'

export const ENDGE_IDE_STANDALONE_WORKSPACE_WIDGET_IDS = [
  ENDGE_IDE_RUNTIME_TREE_WIDGET_ID,
  ENDGE_IDE_PROBLEMS_WIDGET_ID,
  ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID,
] as const

type DockableWidgetPosition = Extract<WidgetPosition, 'left' | 'right' | 'bottom'>

function isDockablePosition(position: WidgetPosition | undefined): position is DockableWidgetPosition {
  return position === 'left' || position === 'right' || position === 'bottom'
}

/** Returns true when a standalone widget currently replaces the editor tab surface. */
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

/** The normal editor surface is visible only while no standalone workspace owns it. */
export function isEditorTabSurfaceVisible(widgets: LayoutWidgetsState): boolean {
  return !ENDGE_IDE_STANDALONE_WORKSPACE_WIDGET_IDS.some(widgetId =>
    isStandaloneWorkspaceWidgetActive(widgets, widgetId),
  )
}
