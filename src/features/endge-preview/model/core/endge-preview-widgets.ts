/* eslint-disable style/max-statements-per-line */
import {
  createWidgetInstance,
  registerWidget,
  setAreaActiveWidget,
  setAreaExpanded,
  setLayoutScope,
  unregisterAllWidgets,
} from '@/components/layouts/grid'
import { endgePreviewWidgetsConfig } from '@/features/endge-preview/config/widgets'

/** Owns the isolated widget federation for the debug preview surface. */
export class EndgePreviewWidgets {
  private _isInitialized = false

  public init(): void {
    if (this._isInitialized) { return }
    setLayoutScope('endge-preview')
    for (const definition of endgePreviewWidgetsConfig) {
      registerWidget(definition)
      createWidgetInstance(definition.id, {}, { activate: true })
    }
    setAreaActiveWidget('left', 'preview-runtime-tree')
    setAreaExpanded('left', true)
    this._isInitialized = true
  }

  public reset(): void {
    if (!this._isInitialized) { return }
    unregisterAllWidgets()
    this._isInitialized = false
  }
}
