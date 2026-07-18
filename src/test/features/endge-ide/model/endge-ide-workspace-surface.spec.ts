import type { LayoutWidgetsState, WidgetDefinition, WidgetDefinitionState } from '@/components/layouts/grid/types'

import { describe, expect, it } from 'vitest'

import { ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID } from '@/features/endge-admin-ui-editor/entities/ui-editor-workspace'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-ide/domain/types/runtime-preview.types'
import { isEditorTabSurfaceVisible } from '@/features/endge-ide/model/core/endge-ide-workspace-surface'

function createWidgets(activeWidget: string | null, expanded = true): LayoutWidgetsState {
  const definitions = [
    { id: 'project', position: 'left' },
    { id: ENDGE_IDE_RUNTIME_TREE_WIDGET_ID, position: 'left' },
    { id: ENDGE_IDE_PROBLEMS_WIDGET_ID, position: 'left' },
    { id: ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID, position: 'left' },
  ].reduce<LayoutWidgetsState['definitions']>((result, item) => {
    result[item.id] = {
      id: item.id,
      title: item.id,
      icon: item.id,
      content: 'component',
      position: item.position,
      minimized: false,
    } as WidgetDefinition & WidgetDefinitionState
    return result
  }, {})

  return {
    areas: {
      left: { size: 250, expanded, activeWidget },
      right: { size: 250, expanded: true, activeWidget: null },
      bottom: { size: 200, expanded: true, activeWidget: null },
      floating: { order: {}, states: {} },
      popup: { states: {} },
    },
    definitions,
    instances: {},
  }
}

describe('endge IDE workspace surface', () => {
  it.each([
    ENDGE_IDE_RUNTIME_TREE_WIDGET_ID,
    ENDGE_IDE_PROBLEMS_WIDGET_ID,
    ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID,
  ])('hides the editor tab surface while %s is active', (widgetId) => {
    expect(isEditorTabSurfaceVisible(createWidgets(widgetId))).toBe(false)
  })

  it('keeps the editor tab surface visible for an ordinary side widget', () => {
    expect(isEditorTabSurfaceVisible(createWidgets('project'))).toBe(true)
  })

  it('keeps the editor tab surface visible when a standalone widget area is collapsed', () => {
    expect(isEditorTabSurfaceVisible(createWidgets(ENDGE_IDE_RUNTIME_TREE_WIDGET_ID, false))).toBe(true)
  })
})
